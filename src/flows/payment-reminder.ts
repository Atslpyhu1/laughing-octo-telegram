import type { FlowStep } from '../whatsapp/types';

/**
 * Payment Reminder Flow
 *
 * Timeline:
 * 1. 3 days before due date — friendly reminder
 * 2. Due date — payment due notification
 * 3. 3 days after due date — overdue notice
 * 4. 7 days after due date — final warning
 * 5. Section 8(1) 7-day breach notice
 *
 * Context variables expected:
 * - amount, property_address, unit_number, due_date
 * - account_holder, bank_name, account_number, payment_reference
 */
export const paymentReminderSteps: FlowStep[] = [
  {
    id: 'step_1_friendly_reminder',
    type: 'send_template',
    config: {
      template_name: 'payment_reminder',
      variables: {},
    },
    next_step_id: 'step_2_wait_3_days',
  },
  {
    id: 'step_2_wait_3_days',
    type: 'wait',
    config: {
      duration_hours: 72, // 3 days
    },
    next_step_id: 'step_3_check_payment',
  },
  {
    id: 'step_3_check_payment',
    type: 'condition',
    config: {
      field: 'payment_received',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_completed', // Payment received — end flow
    on_failure_step_id: 'step_4_due_date_reminder',
  },
  {
    id: 'step_4_due_date_reminder',
    type: 'send_text',
    config: {
      text: 'Reminder: Your rental payment of R{{context.amount}} for {{context.property_address}}, Unit {{context.unit_number}} is due today. Please ensure payment is made to avoid late fees.',
    },
    next_step_id: 'step_5_wait_3_days_after',
  },
  {
    id: 'step_5_wait_3_days_after',
    type: 'wait',
    config: {
      duration_hours: 72, // 3 days after due date
    },
    next_step_id: 'step_6_check_payment_again',
  },
  {
    id: 'step_6_check_payment_again',
    type: 'condition',
    config: {
      field: 'payment_received',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_completed',
    on_failure_step_id: 'step_7_overdue_notice',
  },
  {
    id: 'step_7_overdue_notice',
    type: 'send_template',
    config: {
      template_name: 'payment_overdue',
      variables: {},
    },
    next_step_id: 'step_8_wait_4_more_days',
  },
  {
    id: 'step_8_wait_4_more_days',
    type: 'wait',
    config: {
      duration_hours: 96, // 4 days (now 7 days after due date)
    },
    next_step_id: 'step_9_final_check',
  },
  {
    id: 'step_9_final_check',
    type: 'condition',
    config: {
      field: 'payment_received',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_completed',
    on_failure_step_id: 'step_10_escalate',
  },
  {
    id: 'step_10_escalate',
    type: 'send_text',
    config: {
      text: 'FINAL NOTICE: Your rental payment of R{{context.amount}} is now 7 days overdue. A formal breach notice will be issued if payment is not received within 24 hours. Please contact us immediately to avoid legal proceedings.',
    },
    next_step_id: 'step_11_assign_agent',
  },
  {
    id: 'step_11_assign_agent',
    type: 'assign_agent',
    config: {
      reason: 'Payment 7+ days overdue — Section 8 notice may be required',
    },
  },
  {
    id: 'step_completed',
    type: 'send_text',
    config: {
      text: 'Thank you for your payment. Your account has been updated.',
    },
  },
];

export const paymentReminderFlowDefinition = {
  name: 'Payment Reminder Flow',
  trigger_type: 'payment_due',
  steps: paymentReminderSteps,
  is_active: true,
};
