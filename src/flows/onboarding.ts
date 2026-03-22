import type { FlowStep } from '../whatsapp/types';

/**
 * Tenant Onboarding Flow
 *
 * Timeline:
 * 1. Send welcome message
 * 2. Wait 24 hours
 * 3. Send important property details
 * 4. Wait 24 hours
 * 5. Send first payment information
 *
 * Context variables expected:
 * - tenant_name, property_address, unit_number, agent_name
 * - emergency_contact, monthly_rental, payment_due_day
 * - account_holder, bank_name, account_number, payment_reference
 */
export const onboardingSteps: FlowStep[] = [
  {
    id: 'step_1_welcome',
    type: 'send_template',
    config: {
      template_name: 'welcome_tenant',
      variables: {},
    },
    next_step_id: 'step_2_wait',
  },
  {
    id: 'step_2_wait',
    type: 'wait',
    config: {
      duration_hours: 24,
    },
    next_step_id: 'step_3_property_info',
  },
  {
    id: 'step_3_property_info',
    type: 'send_text',
    config: {
      text: [
        'Hi {{context.tenant_name}}, here are some important details for your tenancy at {{context.property_address}}, Unit {{context.unit_number}}:',
        '',
        'Important Contacts:',
        '- Managing Agent: {{context.agent_name}}',
        '- Emergency (after hours): {{context.emergency_contact}}',
        '',
        'Useful Information:',
        '- For maintenance, send "MAINTENANCE" to this number',
        '- For payment queries, send "PAYMENT"',
        '- To speak to an agent, send "AGENT"',
        '',
        'Please keep this number saved for all communication regarding your tenancy.',
      ].join('\n'),
    },
    next_step_id: 'step_4_wait',
  },
  {
    id: 'step_4_wait',
    type: 'wait',
    config: {
      duration_hours: 24,
    },
    next_step_id: 'step_5_payment_info',
  },
  {
    id: 'step_5_payment_info',
    type: 'send_text',
    config: {
      text: [
        'Hi {{context.tenant_name}}, a reminder about your rental payments:',
        '',
        'Monthly Rental: R{{context.monthly_rental}}',
        'Due Date: {{context.payment_due_day}} of each month',
        '',
        'Banking Details:',
        'Account Holder: {{context.account_holder}}',
        'Bank: {{context.bank_name}}',
        'Account Number: {{context.account_number}}',
        'Your Reference: {{context.payment_reference}}',
        '',
        'Please use your reference number every time you make a payment so we can allocate it correctly.',
        '',
        'If you have any questions, reply to this message.',
      ].join('\n'),
    },
  },
];

export const onboardingFlowDefinition = {
  name: 'Tenant Onboarding Flow',
  trigger_type: 'new_tenant',
  steps: onboardingSteps,
  is_active: true,
};
