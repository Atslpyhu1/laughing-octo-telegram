import { z } from 'zod';
import { noticeGenerator, type NoticeData } from './generator';
import { noticeTracker } from './tracker';
import { whatsappClient } from '../whatsapp/client';
import { buildTemplateComponents, getTemplate } from '../templates';
import { contactService } from '../crm/contacts';
import { logger } from '../index';

/** Input for generating a PIE Act eviction notice */
export const pieEvictionSchema = z.object({
  tenant_id: z.string().uuid(),
  agency_id: z.string().uuid(),
  property_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  property_address: z.string().min(1),
  unit_number: z.string().min(1),
  prior_notice_date: z.string().min(1),
  court_date: z.string().optional(),
  court_name: z.string().optional(),
  case_number: z.string().optional(),
  landlord_name: z.string().optional(),
  agent_name: z.string().optional(),
  agent_company: z.string().optional(),
});

export type PIEEvictionInput = z.infer<typeof pieEvictionSchema>;

/**
 * Generate, send, and track a PIE Act eviction notice.
 *
 * Per the PIE Act (Act 19 of 1998), this notice must be served before
 * eviction proceedings can be instituted. The notice informs the occupier
 * of their rights, including the right to legal representation and
 * access to legal aid.
 */
export async function sendPIEEvictionNotice(input: PIEEvictionInput) {
  // Get tenant contact
  const contact = await contactService.getById(input.tenant_id, input.agency_id);
  if (!contact) {
    throw new Error('Tenant contact not found');
  }

  const noticeData: NoticeData = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    lease_date: input.prior_notice_date, // Use prior notice date for context
    amount_owed: 0, // Not applicable for PIE notice
    arrears_period: '',
    compliance_deadline: input.court_date ?? 'To be determined',
    account_holder: '',
    bank_name: '',
    account_number: '',
    payment_reference: `PIE-${Date.now()}`,
    landlord_name: input.landlord_name,
    agent_name: input.agent_name,
    agent_company: input.agent_company,
  };

  // Generate PDF
  const { pdfUrl } = await noticeGenerator.generatePDF(
    'pie_eviction',
    noticeData,
    input.agency_id,
  );

  // Send WhatsApp template message
  const template = getTemplate('eviction_notice');
  if (!template) {
    throw new Error('Template eviction_notice not found');
  }

  const variables: Record<string, string> = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    prior_notice_date: input.prior_notice_date,
    court_date: input.court_date ?? 'To be confirmed',
    court_name: input.court_name ?? 'To be confirmed',
    case_number: input.case_number ?? 'To be assigned',
  };

  const components = buildTemplateComponents(template, variables);
  const waResponse = await whatsappClient.sendTemplate(
    contact.phone,
    'eviction_notice',
    'en_ZA',
    components,
  );

  const waMessageId = waResponse.messages?.[0]?.id;

  // Track delivery
  const delivery = await noticeTracker.trackNotice({
    notice_type: 'pie_eviction',
    tenant_id: input.tenant_id,
    property_id: input.property_id,
    unit_id: input.unit_id,
    agency_id: input.agency_id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
    deadline_date: input.court_date ?? new Date().toISOString().split('T')[0],
    legal_reference: 'Section 4 of the Prevention of Illegal Eviction from and Unlawful Occupation of Land Act 19 of 1998',
  });

  logger.info(
    { deliveryId: delivery.id, tenantId: input.tenant_id },
    'PIE Act eviction notice sent',
  );

  return {
    delivery_id: delivery.id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
  };
}
