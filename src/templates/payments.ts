import type { MessageTemplate } from './index';

/**
 * Payment-related WhatsApp message templates.
 */
export const paymentTemplates: Record<string, MessageTemplate> = {
  payment_reminder: {
    name: 'payment_reminder',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Payment Reminder',
      },
      {
        type: 'BODY',
        text: [
          'Hi {{1}},',
          '',
          'This is a friendly reminder that your rental payment of R{{2}} for {{3}}, Unit {{4}} is due on {{5}}.',
          '',
          'Payment details:',
          'Account holder: {{6}}',
          'Bank: {{7}}',
          'Account number: {{8}}',
          'Reference: {{9}}',
          '',
          'If you have already made payment, please disregard this message.',
          '',
          'Thank you for being a valued tenant.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Payment Made' },
          { type: 'QUICK_REPLY', text: 'Need Extension' },
          { type: 'QUICK_REPLY', text: 'Contact Agent' },
        ],
      },
    ],
    variables: [
      'tenant_name',
      'amount',
      'property_address',
      'unit_number',
      'due_date',
      'account_holder',
      'bank_name',
      'account_number',
      'payment_reference',
    ],
  },

  payment_overdue: {
    name: 'payment_overdue',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Payment Overdue',
      },
      {
        type: 'BODY',
        text: [
          'Dear {{1}},',
          '',
          'Your rental payment for {{2}}, Unit {{3}} is now overdue.',
          '',
          'Amount due: R{{4}}',
          'Due date: {{5}}',
          'Days overdue: {{6}}',
          '',
          'Please make payment immediately to avoid further action. Continued non-payment may result in a formal breach notice being issued in terms of the Rental Housing Act.',
          '',
          'Payment details:',
          'Account holder: {{7}}',
          'Bank: {{8}}',
          'Account number: {{9}}',
          'Reference: {{10}}',
          '',
          'If you are experiencing financial difficulty, please contact us to discuss a payment arrangement.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Payment Made' },
          { type: 'QUICK_REPLY', text: 'Request Arrangement' },
          { type: 'QUICK_REPLY', text: 'Contact Agent' },
        ],
      },
    ],
    variables: [
      'tenant_name',
      'property_address',
      'unit_number',
      'amount',
      'due_date',
      'days_overdue',
      'account_holder',
      'bank_name',
      'account_number',
      'payment_reference',
    ],
  },
};
