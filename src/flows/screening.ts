import type { FlowStep } from '../whatsapp/types';

/**
 * Screening Flow
 *
 * Timeline:
 * 1. Send screening invitation with application link
 * 2. Wait 48 hours
 * 3. Check if application was submitted
 * 4. If not, send reminder
 * 5. Wait 48 hours
 * 6. Final reminder or assign agent
 *
 * Context variables expected:
 * - applicant_name, property_address, unit_number, application_url, deadline_date
 */
export const screeningSteps: FlowStep[] = [
  {
    id: 'step_1_invite',
    type: 'send_template',
    config: {
      template_name: 'screening_invite',
      variables: {},
    },
    next_step_id: 'step_2_wait',
  },
  {
    id: 'step_2_wait',
    type: 'wait',
    config: {
      duration_hours: 48,
    },
    next_step_id: 'step_3_check',
  },
  {
    id: 'step_3_check',
    type: 'condition',
    config: {
      field: 'application_submitted',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_6_processing',
    on_failure_step_id: 'step_4_reminder',
  },
  {
    id: 'step_4_reminder',
    type: 'send_text',
    config: {
      text: 'Hi {{context.applicant_name}}, just a friendly reminder that your screening application for {{context.property_address}}, Unit {{context.unit_number}} is still pending. Please complete it at {{context.application_url}} by {{context.deadline_date}} to secure your application.',
    },
    next_step_id: 'step_5_wait_again',
  },
  {
    id: 'step_5_wait_again',
    type: 'wait',
    config: {
      duration_hours: 48,
    },
    next_step_id: 'step_5b_final_check',
  },
  {
    id: 'step_5b_final_check',
    type: 'condition',
    config: {
      field: 'application_submitted',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_6_processing',
    on_failure_step_id: 'step_5c_assign_agent',
  },
  {
    id: 'step_5c_assign_agent',
    type: 'assign_agent',
    config: {
      reason: 'Screening application not submitted after 2 reminders',
    },
  },
  {
    id: 'step_6_processing',
    type: 'send_text',
    config: {
      text: 'Thank you for completing your screening application. We are currently processing your information. You will receive the outcome within 3-5 business days.',
    },
    next_step_id: 'step_7_wait_processing',
  },
  {
    id: 'step_7_wait_processing',
    type: 'wait',
    config: {
      duration_hours: 72, // Wait for manual review
    },
    next_step_id: 'step_8_result_check',
  },
  {
    id: 'step_8_result_check',
    type: 'condition',
    config: {
      field: 'screening_result',
      operator: 'exists',
    },
    next_step_id: 'step_9_send_result',
    on_failure_step_id: 'step_8b_assign_agent',
  },
  {
    id: 'step_8b_assign_agent',
    type: 'assign_agent',
    config: {
      reason: 'Screening result pending — manual review required',
    },
  },
  {
    id: 'step_9_send_result',
    type: 'send_template',
    config: {
      template_name: 'screening_result',
      variables: {},
    },
  },
];

export const screeningFlowDefinition = {
  name: 'Tenant Screening Flow',
  trigger_type: 'screening_invite',
  steps: screeningSteps,
  is_active: true,
};
