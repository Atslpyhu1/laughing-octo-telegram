import type { FlowStep } from '../whatsapp/types';

/**
 * Maintenance Request Flow
 *
 * Timeline:
 * 1. Acknowledge the request
 * 2. Wait 4 hours for contractor assignment
 * 3. Check if contractor assigned
 * 4. Send update to tenant
 * 5. Wait 48 hours
 * 6. Check if resolved
 * 7. Send resolution confirmation or escalate
 *
 * Context variables expected:
 * - tenant_name, request_number, issue_description
 * - property_address, unit_number
 */
export const maintenanceSteps: FlowStep[] = [
  {
    id: 'step_1_acknowledge',
    type: 'send_template',
    config: {
      template_name: 'maintenance_update',
      variables: {
        status: 'Received',
        additional_details:
          'Your maintenance request has been received and logged. A contractor will be assigned shortly.',
      },
    },
    next_step_id: 'step_2_wait_assignment',
  },
  {
    id: 'step_2_wait_assignment',
    type: 'wait',
    config: {
      duration_hours: 4,
    },
    next_step_id: 'step_3_check_assignment',
  },
  {
    id: 'step_3_check_assignment',
    type: 'condition',
    config: {
      field: 'contractor_assigned',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_4_update_assigned',
    on_failure_step_id: 'step_3b_assign_agent',
  },
  {
    id: 'step_3b_assign_agent',
    type: 'assign_agent',
    config: {
      reason: 'Maintenance request requires contractor assignment',
    },
    next_step_id: 'step_4_update_assigned',
  },
  {
    id: 'step_4_update_assigned',
    type: 'send_template',
    config: {
      template_name: 'maintenance_update',
      variables: {
        status: 'In Progress',
        additional_details:
          'A contractor has been assigned to your maintenance request. They will contact you to arrange access.',
      },
    },
    next_step_id: 'step_5_wait_resolution',
  },
  {
    id: 'step_5_wait_resolution',
    type: 'wait',
    config: {
      duration_hours: 48,
    },
    next_step_id: 'step_6_check_resolved',
  },
  {
    id: 'step_6_check_resolved',
    type: 'condition',
    config: {
      field: 'issue_resolved',
      operator: 'equals',
      value: true,
    },
    next_step_id: 'step_7_resolution_confirmation',
    on_failure_step_id: 'step_8_follow_up',
  },
  {
    id: 'step_7_resolution_confirmation',
    type: 'send_template',
    config: {
      template_name: 'maintenance_update',
      variables: {
        status: 'Resolved',
        additional_details:
          'Your maintenance request has been resolved. If the issue persists, please let us know.',
      },
    },
  },
  {
    id: 'step_8_follow_up',
    type: 'send_template',
    config: {
      template_name: 'maintenance_update',
      variables: {
        status: 'Follow-up Required',
        additional_details:
          'We are following up on your maintenance request. An agent will contact you for an update.',
      },
    },
    next_step_id: 'step_9_escalate',
  },
  {
    id: 'step_9_escalate',
    type: 'assign_agent',
    config: {
      reason: 'Maintenance request unresolved after 48 hours',
    },
  },
];

export const maintenanceFlowDefinition = {
  name: 'Maintenance Request Flow',
  trigger_type: 'maintenance_report',
  steps: maintenanceSteps,
  is_active: true,
};
