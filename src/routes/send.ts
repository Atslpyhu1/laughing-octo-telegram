import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { whatsappClient } from '../whatsapp/client';
import { getSupabaseClient } from '../db/client';
import { buildTemplateComponents, getTemplate } from '../templates';
import { segmentService, segmentSchema } from '../crm/segments';
import { BULK_BATCH_SIZE } from '../config';
import { logger } from '../index';

export const sendRouter = Router();

/** Send a single text message */
const sendTextSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1).max(4096),
  agency_id: z.string().uuid(),
});

sendRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = sendTextSchema.parse(req.body);
    const result = await whatsappClient.sendText(body.to, body.message);

    // Store outbound message
    const supabase = getSupabaseClient();
    await supabase.from('whatsapp_messages').insert({
      agency_id: body.agency_id,
      direction: 'outbound',
      type: 'text',
      content: body.message,
      wa_message_id: result.messages?.[0]?.id,
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, message_id: result.messages?.[0]?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to send message');
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/** Send a template message */
const sendTemplateSchema = z.object({
  to: z.string().min(1),
  template_name: z.string().min(1),
  language: z.string().default('en_ZA'),
  variables: z.record(z.string()).default({}),
  agency_id: z.string().uuid(),
});

sendRouter.post('/template', async (req: Request, res: Response) => {
  try {
    const body = sendTemplateSchema.parse(req.body);
    const template = getTemplate(body.template_name);

    if (!template) {
      res.status(404).json({ error: `Template '${body.template_name}' not found` });
      return;
    }

    const components = buildTemplateComponents(template, body.variables);
    const result = await whatsappClient.sendTemplate(
      body.to,
      body.template_name,
      body.language,
      components,
    );

    // Store outbound message
    const supabase = getSupabaseClient();
    await supabase.from('whatsapp_messages').insert({
      agency_id: body.agency_id,
      direction: 'outbound',
      type: 'template',
      content: body.template_name,
      template_name: body.template_name,
      wa_message_id: result.messages?.[0]?.id,
      status: 'sent',
      metadata: { variables: body.variables },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, message_id: result.messages?.[0]?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to send template message');
    res.status(500).json({ error: 'Failed to send template message' });
  }
});

/** Bulk send with rate limiting and segmentation */
const bulkSendSchema = z.object({
  template_name: z.string().min(1),
  language: z.string().default('en_ZA'),
  variables: z.record(z.string()).default({}),
  segment: segmentSchema,
});

sendRouter.post('/bulk', async (req: Request, res: Response) => {
  try {
    const body = bulkSendSchema.parse(req.body);
    const template = getTemplate(body.template_name);

    if (!template) {
      res.status(404).json({ error: `Template '${body.template_name}' not found` });
      return;
    }

    // Get contacts in segment
    const contacts = await segmentService.getSegmentContacts(body.segment);

    if (contacts.length === 0) {
      res.json({ success: true, sent: 0, failed: 0, message: 'No contacts in segment' });
      return;
    }

    // Respond immediately with job info
    res.json({
      success: true,
      queued: contacts.length,
      message: `Sending to ${contacts.length} contacts in batches of ${BULK_BATCH_SIZE}`,
    });

    // Process in batches (fire-and-forget after responding)
    const results = { sent: 0, failed: 0 };

    for (let i = 0; i < contacts.length; i += BULK_BATCH_SIZE) {
      const batch = contacts.slice(i, i + BULK_BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (contact) => {
          try {
            const contactVars = {
              ...body.variables,
              tenant_name: contact.name,
            };
            const components = buildTemplateComponents(template, contactVars);
            await whatsappClient.sendTemplate(
              contact.phone,
              body.template_name,
              body.language,
              components,
            );
            results.sent++;
          } catch {
            results.failed++;
          }
        }),
      );
    }

    logger.info(
      { template: body.template_name, sent: results.sent, failed: results.failed },
      'Bulk send completed',
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to initiate bulk send');
    res.status(500).json({ error: 'Failed to initiate bulk send' });
  }
});
