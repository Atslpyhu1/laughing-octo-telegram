import type { MessageTemplate } from './index';

/**
 * General-purpose WhatsApp message templates for ProPassure.
 */
export const generalTemplates: Record<string, MessageTemplate> = {
  welcome_tenant: {
    name: 'welcome_tenant',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Welcome to Your New Home!',
      },
      {
        type: 'BODY',
        text: [
          'Hi {{1}},',
          '',
          'Welcome to {{2}}, Unit {{3}}! We\'re pleased to have you as a tenant.',
          '',
          'Here are some important details:',
          '',
          'Managing Agent: {{4}}',
          'Emergency Contact: {{5}}',
          'Monthly Rental: R{{6}}',
          'Payment Due Date: {{7}} of each month',
          '',
          'Banking Details:',
          'Account holder: {{8}}',
          'Bank: {{9}}',
          'Account number: {{10}}',
          'Your reference: {{11}}',
          '',
          'For maintenance requests, simply reply to this number with "MAINTENANCE" followed by a description of the issue.',
          '',
          'We hope you enjoy your new home!',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Report Maintenance' },
          { type: 'QUICK_REPLY', text: 'Contact Agent' },
          { type: 'QUICK_REPLY', text: 'Lease Details' },
        ],
      },
    ],
    variables: [
      'tenant_name',
      'property_address',
      'unit_number',
      'agent_name',
      'emergency_contact',
      'monthly_rental',
      'payment_due_day',
      'account_holder',
      'bank_name',
      'account_number',
      'payment_reference',
    ],
  },

  maintenance_update: {
    name: 'maintenance_update',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Maintenance Request Update',
      },
      {
        type: 'BODY',
        text: [
          'Hi {{1}},',
          '',
          'There is an update on your maintenance request:',
          '',
          'Request #: {{2}}',
          'Issue: {{3}}',
          'Status: {{4}}',
          '',
          '{{5}}',
          '',
          'If you have any questions, please reply to this message.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Issue Resolved' },
          { type: 'QUICK_REPLY', text: 'Still an Issue' },
          { type: 'QUICK_REPLY', text: 'Contact Agent' },
        ],
      },
    ],
    variables: [
      'tenant_name',
      'request_number',
      'issue_description',
      'status',
      'additional_details',
    ],
  },

  lease_renewal: {
    name: 'lease_renewal',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Lease Renewal Reminder',
      },
      {
        type: 'BODY',
        text: [
          'Dear {{1}},',
          '',
          'Your lease agreement for {{2}}, Unit {{3}} is due to expire on {{4}}.',
          '',
          'We would like to offer you the opportunity to renew your lease. The proposed new terms are:',
          '',
          'New monthly rental: R{{5}}',
          'Lease period: {{6}}',
          'Proposed start date: {{7}}',
          '',
          'In terms of the Consumer Protection Act, you have the right to cancel a fixed-term agreement by giving 20 business days\' written notice.',
          '',
          'Please indicate your preference below, or contact your agent to discuss.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Renew Lease' },
          { type: 'QUICK_REPLY', text: 'Discuss Terms' },
          { type: 'QUICK_REPLY', text: 'Not Renewing' },
        ],
      },
    ],
    variables: [
      'tenant_name',
      'property_address',
      'unit_number',
      'expiry_date',
      'new_rental_amount',
      'lease_period',
      'start_date',
    ],
  },
};
