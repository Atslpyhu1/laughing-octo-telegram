import type { MessageTemplate } from './index';

/**
 * Tenant screening-related WhatsApp message templates.
 */
export const screeningTemplates: Record<string, MessageTemplate> = {
  screening_invite: {
    name: 'screening_invite',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Tenant Screening Application',
      },
      {
        type: 'BODY',
        text: [
          'Hi {{1}},',
          '',
          'Thank you for your interest in renting at {{2}}, Unit {{3}}.',
          '',
          'To proceed with your application, please complete the tenant screening process. This includes:',
          '- Identity verification (SA ID or passport)',
          '- Credit check',
          '- Employment and income verification',
          '- Previous rental references',
          '',
          'Please click the link below to start your application:',
          '{{4}}',
          '',
          'Application deadline: {{5}}',
          '',
          'In compliance with the Protection of Personal Information Act (POPIA), your data will be processed solely for the purpose of evaluating your rental application. By proceeding, you consent to this processing.',
          '',
          'Should you have any questions, please reply to this message.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management — POPIA Compliant',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Start Application' },
          { type: 'QUICK_REPLY', text: 'Ask a Question' },
        ],
      },
    ],
    variables: [
      'applicant_name',
      'property_address',
      'unit_number',
      'application_url',
      'deadline_date',
    ],
  },

  screening_result: {
    name: 'screening_result',
    category: 'UTILITY',
    language: 'en_ZA',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Screening Application Update',
      },
      {
        type: 'BODY',
        text: [
          'Dear {{1}},',
          '',
          'We have completed the screening process for your application at {{2}}, Unit {{3}}.',
          '',
          'Application status: {{4}}',
          '',
          '{{5}}',
          '',
          'If you have any questions about this decision, please contact your agent.',
          '',
          'In accordance with POPIA, you may request access to the information used in making this decision by contacting our information officer.',
        ].join('\n'),
      },
      {
        type: 'FOOTER',
        text: 'ProPassure Property Management',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Contact Agent' },
          { type: 'QUICK_REPLY', text: 'Request Info' },
        ],
      },
    ],
    variables: [
      'applicant_name',
      'property_address',
      'unit_number',
      'status',
      'additional_info',
    ],
  },
};
