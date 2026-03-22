import { getSupabaseClient } from '../db/client';
import { whatsappClient } from '../whatsapp/client';
import { contactService } from '../crm/contacts';
import { buildTemplateComponents, getTemplate } from '../templates';
import { logger } from '../index';
import type { DBAutomatedFlow, DBFlowExecution, FlowStep } from '../whatsapp/types';

/**
 * Flow execution engine that processes automated multi-step workflows.
 * Supports delays, conditionals, template sends, and agent escalation.
 */
class FlowEngine {
  private supabase = getSupabaseClient();

  /**
   * Trigger a flow for a specific contact.
   */
  async triggerFlow(
    flowId: string,
    contactId: string,
    agencyId: string,
    initialContext: Record<string, unknown> = {},
  ): Promise<DBFlowExecution> {
    // Load the flow definition
    const { data: flow, error } = await this.supabase
      .from('automated_flows')
      .select()
      .eq('id', flowId)
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .single();

    if (error || !flow) {
      throw new Error(`Flow not found or inactive: ${flowId}`);
    }

    const typedFlow = flow as DBAutomatedFlow;

    if (!typedFlow.steps || typedFlow.steps.length === 0) {
      throw new Error('Flow has no steps defined');
    }

    // Check for existing active execution for this contact + flow
    const { data: existing } = await this.supabase
      .from('flow_executions')
      .select('id')
      .eq('flow_id', flowId)
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .single();

    if (existing) {
      throw new Error(`Flow ${flowId} is already active for contact ${contactId}`);
    }

    // Create execution record
    const { data: execution, error: execError } = await this.supabase
      .from('flow_executions')
      .insert({
        flow_id: flowId,
        contact_id: contactId,
        agency_id: agencyId,
        current_step: typedFlow.steps[0].id,
        status: 'active',
        context: initialContext,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (execError || !execution) {
      throw new Error(`Failed to create flow execution: ${execError?.message}`);
    }

    // Execute the first step
    await this.executeStep(execution as DBFlowExecution, typedFlow);

    return execution as DBFlowExecution;
  }

  /**
   * Execute the current step of a flow.
   */
  async executeStep(
    execution: DBFlowExecution,
    flow: DBAutomatedFlow,
  ): Promise<void> {
    const step = flow.steps.find((s) => s.id === execution.current_step);
    if (!step) {
      await this.completeExecution(execution.id);
      return;
    }

    try {
      switch (step.type) {
        case 'send_template':
          await this.executeSendTemplate(execution, step);
          break;
        case 'send_text':
          await this.executeSendText(execution, step);
          break;
        case 'wait':
          await this.executeWait(execution, step, flow);
          return; // Don't advance yet — will be resumed by scheduler
        case 'condition':
          await this.executeCondition(execution, step, flow);
          return; // Condition handles its own next step
        case 'assign_agent':
          await this.executeAssignAgent(execution, step);
          break;
      }

      // Advance to next step
      if (step.next_step_id) {
        await this.advanceExecution(execution.id, step.next_step_id);
        const updatedExecution = {
          ...execution,
          current_step: step.next_step_id,
        };
        await this.executeStep(updatedExecution, flow);
      } else {
        await this.completeExecution(execution.id);
      }
    } catch (error) {
      logger.error(
        { error, executionId: execution.id, stepId: step.id },
        'Flow step execution failed',
      );

      if (step.on_failure_step_id) {
        await this.advanceExecution(execution.id, step.on_failure_step_id);
      } else {
        await this.failExecution(execution.id);
      }
    }
  }

  /**
   * Resume a paused flow execution (e.g., after a wait step).
   */
  async resumeExecution(executionId: string): Promise<void> {
    const { data: execution } = await this.supabase
      .from('flow_executions')
      .select()
      .eq('id', executionId)
      .eq('status', 'paused')
      .single();

    if (!execution) {
      logger.warn({ executionId }, 'No paused execution found to resume');
      return;
    }

    const { data: flow } = await this.supabase
      .from('automated_flows')
      .select()
      .eq('id', execution.flow_id)
      .single();

    if (!flow) {
      logger.error({ flowId: execution.flow_id }, 'Flow not found for execution');
      return;
    }

    // Reactivate the execution
    await this.supabase
      .from('flow_executions')
      .update({ status: 'active' })
      .eq('id', executionId);

    const typedExecution = execution as DBFlowExecution;
    const typedFlow = flow as DBAutomatedFlow;
    const currentStep = typedFlow.steps.find((s) => s.id === typedExecution.current_step);

    if (currentStep?.next_step_id) {
      await this.advanceExecution(executionId, currentStep.next_step_id);
      const updatedExecution = {
        ...typedExecution,
        current_step: currentStep.next_step_id,
      };
      await this.executeStep(updatedExecution, typedFlow);
    } else {
      await this.completeExecution(executionId);
    }
  }

  private async executeSendTemplate(
    execution: DBFlowExecution,
    step: FlowStep,
  ): Promise<void> {
    const templateName = step.config.template_name as string;
    const variables = step.config.variables as Record<string, string> | undefined;
    const contact = await contactService.getById(execution.contact_id, execution.agency_id);

    if (!contact) throw new Error('Contact not found');

    const template = getTemplate(templateName);
    if (!template) throw new Error(`Template ${templateName} not found`);

    // Merge flow context with step variables
    const mergedVars: Record<string, string> = {
      ...(execution.context as Record<string, string>),
      ...variables,
      tenant_name: contact.name,
    };

    const components = buildTemplateComponents(template, mergedVars);
    await whatsappClient.sendTemplate(contact.phone, templateName, 'en_ZA', components);

    logger.info(
      { executionId: execution.id, template: templateName },
      'Flow step: template sent',
    );
  }

  private async executeSendText(
    execution: DBFlowExecution,
    step: FlowStep,
  ): Promise<void> {
    const text = step.config.text as string;
    const contact = await contactService.getById(execution.contact_id, execution.agency_id);

    if (!contact) throw new Error('Contact not found');

    // Replace {{context.xxx}} placeholders with context values
    const resolvedText = text.replace(/\{\{context\.(\w+)\}\}/g, (_match, key) => {
      return String((execution.context as Record<string, unknown>)[key] ?? '');
    });

    await whatsappClient.sendText(contact.phone, resolvedText);

    logger.info(
      { executionId: execution.id },
      'Flow step: text message sent',
    );
  }

  private async executeWait(
    execution: DBFlowExecution,
    step: FlowStep,
    _flow: DBAutomatedFlow,
  ): Promise<void> {
    const durationMs = (step.config.duration_hours as number ?? 24) * 60 * 60 * 1000;
    const resumeAt = new Date(Date.now() + durationMs).toISOString();

    // Pause the execution
    await this.supabase
      .from('flow_executions')
      .update({
        status: 'paused',
        context: {
          ...execution.context,
          resume_at: resumeAt,
        },
      })
      .eq('id', execution.id);

    logger.info(
      { executionId: execution.id, resumeAt },
      'Flow step: waiting',
    );
  }

  private async executeCondition(
    execution: DBFlowExecution,
    step: FlowStep,
    flow: DBAutomatedFlow,
  ): Promise<void> {
    const field = step.config.field as string;
    const operator = step.config.operator as string;
    const value = step.config.value;
    const contextValue = (execution.context as Record<string, unknown>)[field];

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = contextValue === value;
        break;
      case 'not_equals':
        conditionMet = contextValue !== value;
        break;
      case 'exists':
        conditionMet = contextValue !== undefined && contextValue !== null;
        break;
      case 'gt':
        conditionMet = Number(contextValue) > Number(value);
        break;
      case 'lt':
        conditionMet = Number(contextValue) < Number(value);
        break;
      default:
        conditionMet = false;
    }

    const nextStepId = conditionMet
      ? step.next_step_id
      : step.on_failure_step_id;

    if (nextStepId) {
      await this.advanceExecution(execution.id, nextStepId);
      const updatedExecution = { ...execution, current_step: nextStepId };
      await this.executeStep(updatedExecution, flow);
    } else {
      await this.completeExecution(execution.id);
    }
  }

  private async executeAssignAgent(
    execution: DBFlowExecution,
    step: FlowStep,
  ): Promise<void> {
    const reason = (step.config.reason as string) ?? 'Assigned by automated flow';

    // Find active conversation for this contact
    const { data: conversation } = await this.supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('contact_id', execution.contact_id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (conversation) {
      await this.supabase
        .from('whatsapp_conversations')
        .update({
          status: 'pending_agent',
          context: { escalation_reason: reason, from_flow: execution.flow_id },
        })
        .eq('id', conversation.id);
    }

    logger.info(
      { executionId: execution.id, reason },
      'Flow step: assigned to agent',
    );
  }

  private async advanceExecution(executionId: string, nextStepId: string): Promise<void> {
    await this.supabase
      .from('flow_executions')
      .update({ current_step: nextStepId })
      .eq('id', executionId);
  }

  private async completeExecution(executionId: string): Promise<void> {
    await this.supabase
      .from('flow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
  }

  private async failExecution(executionId: string): Promise<void> {
    await this.supabase
      .from('flow_executions')
      .update({ status: 'failed' })
      .eq('id', executionId);
  }
}

export const flowEngine = new FlowEngine();
