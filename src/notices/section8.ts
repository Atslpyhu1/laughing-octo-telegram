import { z } from 'zod';
import {
  calculateSection8SevenDayDeadline,
  calculateSection8TwentyDayDeadline,
} from '../config/business-days';
import { noticeGenerator, type NoticeData } from './generator';
import { noticeTracker } from './tracker';
import { whatsappClient } from '../whatsapp/client';
import { buildTemplateComponents, getTemplate } from '../templates';
import { contactService } from '../crm/contacts';
import { logger } from '../index';

/** Input for generating a Section 8(1) 7-day notice */
export const section8SevenDaySchema = z.object({
  tenant_id: z.string().uuid(),
  agency_id: z.string().uuid(),
  property_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  property_address: z.string().min(1),
  unit_number: z.string().min(1),
  lease_date: z.string().min(1),
  amount_owed: z.number().positive(),
  arrears_period: z.string().min(1),
  account_holder: z.string().min(1),
  bank_name: z.string().min(1),
  account_number: z.string().min(1),
  payment_reference: z.string().min(1),
  landlord_name: z.string().optional(),
  agent_name: z.string().optional(),
  agent_company: z.string().optional(),
});

/** Input for generating a Section 8(1)(a) 20 business day notice */
export const section8TwentyDaySchema = section8SevenDaySchema;

export type Section8Input = z.infer<typeof section8SevenDaySchema>;

/**
 * Generate, send, and track a Section 8(1) 7-day breach notice.
 */
export async function sendSection8SevenDayNotice(input: Section8Input) {
  const issueDate = new Date();
  const deadline = calculateSection8SevenDayDeadline(issueDate);
  const deadlineStr = deadline.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Get tenant contact
  const contact = await contactService.getById(input.tenant_id, input.agency_id);
  if (!contact) {
    throw new Error('Tenant contact not found');
  }

  const noticeData: NoticeData = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    lease_date: input.lease_date,
    amount_owed: input.amount_owed,
    arrears_period: input.arrears_period,
    compliance_deadline: deadlineStr,
    account_holder: input.account_holder,
    bank_name: input.bank_name,
    account_number: input.account_number,
    payment_reference: input.payment_reference,
    landlord_name: input.landlord_name,
    agent_name: input.agent_name,
    agent_company: input.agent_company,
  };

  // Generate PDF
  const { pdfUrl } = await noticeGenerator.generatePDF(
    'section8_7day',
    noticeData,
    input.agency_id,
  );

  // Send WhatsApp template message
  const template = getTemplate('section8_7day_notice');
  if (!template) {
    throw new Error('Template section8_7day_notice not found');
  }

  const variables: Record<string, string> = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    lease_date: input.lease_date,
    amount_owed: input.amount_owed.toFixed(2),
    arrears_period: input.arrears_period,
    compliance_deadline: deadlineStr,
    account_holder: input.account_holder,
    bank_name: input.bank_name,
    account_number: input.account_number,
    payment_reference: input.payment_reference,
  };

  const components = buildTemplateComponents(template, variables);
  const waResponse = await whatsappClient.sendTemplate(
    contact.phone,
    'section8_7day_notice',
    'en_ZA',
    components,
  );

  const waMessageId = waResponse.messages?.[0]?.id;

  // Track delivery
  const delivery = await noticeTracker.trackNotice({
    notice_type: 'section8_7day',
    tenant_id: input.tenant_id,
    property_id: input.property_id,
    unit_id: input.unit_id,
    agency_id: input.agency_id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
    amount_owed: input.amount_owed,
    deadline_date: deadline.toISOString().split('T')[0],
    legal_reference: 'Section 8(1) of the Rental Housing Act 50 of 1999',
  });

  logger.info(
    { deliveryId: delivery.id, tenantId: input.tenant_id, deadline: deadlineStr },
    'Section 8(1) 7-day notice sent',
  );

  return {
    delivery_id: delivery.id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
    deadline: deadlineStr,
    deadline_date: deadline.toISOString().split('T')[0],
  };
}

/**
 * Generate, send, and track a Section 8(1)(a) 20 business day notice.
 */
export async function sendSection8TwentyDayNotice(input: Section8Input) {
  const issueDate = new Date();
  const deadline = calculateSection8TwentyDayDeadline(issueDate);
  const deadlineStr = deadline.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Get tenant contact
  const contact = await contactService.getById(input.tenant_id, input.agency_id);
  if (!contact) {
    throw new Error('Tenant contact not found');
  }

  const noticeData: NoticeData = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    lease_date: input.lease_date,
    amount_owed: input.amount_owed,
    arrears_period: input.arrears_period,
    compliance_deadline: deadlineStr,
    account_holder: input.account_holder,
    bank_name: input.bank_name,
    account_number: input.account_number,
    payment_reference: input.payment_reference,
    landlord_name: input.landlord_name,
    agent_name: input.agent_name,
    agent_company: input.agent_company,
  };

  // Generate PDF
  const { pdfUrl } = await noticeGenerator.generatePDF(
    'section8_20day',
    noticeData,
    input.agency_id,
  );

  // Send WhatsApp template message
  const template = getTemplate('section8_20day_notice');
  if (!template) {
    throw new Error('Template section8_20day_notice not found');
  }

  const variables: Record<string, string> = {
    tenant_name: contact.name,
    property_address: input.property_address,
    unit_number: input.unit_number,
    lease_date: input.lease_date,
    amount_owed: input.amount_owed.toFixed(2),
    arrears_period: input.arrears_period,
    compliance_deadline: deadlineStr,
    account_holder: input.account_holder,
    bank_name: input.bank_name,
    account_number: input.account_number,
    payment_reference: input.payment_reference,
  };

  const components = buildTemplateComponents(template, variables);
  const waResponse = await whatsappClient.sendTemplate(
    contact.phone,
    'section8_20day_notice',
    'en_ZA',
    components,
  );

  const waMessageId = waResponse.messages?.[0]?.id;

  // Track delivery
  const delivery = await noticeTracker.trackNotice({
    notice_type: 'section8_20day',
    tenant_id: input.tenant_id,
    property_id: input.property_id,
    unit_id: input.unit_id,
    agency_id: input.agency_id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
    amount_owed: input.amount_owed,
    deadline_date: deadline.toISOString().split('T')[0],
    legal_reference: 'Section 14(2)(b)(i)(bb) of the Consumer Protection Act 68 of 2008, read with Section 8(1)(a) of the Rental Housing Act 50 of 1999',
  });

  logger.info(
    { deliveryId: delivery.id, tenantId: input.tenant_id, deadline: deadlineStr },
    'Section 8(1)(a) 20 business day notice sent',
  );

  return {
    delivery_id: delivery.id,
    wa_message_id: waMessageId,
    pdf_url: pdfUrl,
    deadline: deadlineStr,
    deadline_date: deadline.toISOString().split('T')[0],
  };
}
