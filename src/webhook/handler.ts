import { Router, Request, Response } from 'express';
import { logger } from '../index';
import { verifyWebhookSignature, verifyWebhookSubscription } from './verify';
import { getSupabaseClient } from '../db/client';
import { conversationManager } from '../conversations/manager';
import type { WhatsAppWebhookPayload, InboundMessage, MessageStatus, WebhookContact } from '../whatsapp/types';

export const webhookRouter = Router();

/** Set of recently processed message IDs for deduplication */
const processedMessages = new Set<string>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function deduplicateMessage(messageId: string): boolean {
  if (processedMessages.has(messageId)) {
    return true; // Already processed
  }
  processedMessages.add(messageId);
  setTimeout(() => processedMessages.delete(messageId), DEDUP_TTL_MS);
  return false;
}

// GET — webhook verification
webhookRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const result = verifyWebhookSubscription(mode, token, challenge);

  if (result.valid) {
    logger.info('Webhook verification successful');
    res.status(200).send(result.challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.sendStatus(403);
  }
});

// POST — receive messages and status updates
webhookRouter.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = req.body as Buffer;

  // Verify signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Invalid webhook signature');
    res.sendStatus(401);
    return;
  }

  // Always respond 200 quickly to avoid retries
  res.sendStatus(200);

  try {
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody.toString());

    if (payload.object !== 'whatsapp_business_account') {
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await handleInboundMessage(message, value.contacts?.[0]);
          }
        }

        // Handle status updates (sent, delivered, read, failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error processing webhook payload');
  }
});

async function handleInboundMessage(
  message: InboundMessage,
  contact: WebhookContact | undefined,
): Promise<void> {
  // Deduplicate
  if (deduplicateMessage(message.id)) {
    logger.debug({ messageId: message.id }, 'Duplicate message ignored');
    return;
  }

  logger.info(
    { from: message.from, type: message.type, messageId: message.id },
    'Inbound message received',
  );

  const supabase = getSupabaseClient();

  // Upsert contact
  const contactName = contact?.profile?.name ?? 'Unknown';
  const { data: dbContact } = await supabase
    .from('whatsapp_contacts')
    .upsert(
      {
        phone: message.from,
        wa_id: message.from,
        name: contactName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'wa_id' },
    )
    .select('id, agency_id')
    .single();

  if (!dbContact) {
    logger.error({ from: message.from }, 'Failed to upsert contact');
    return;
  }

  // Get or create conversation
  let { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('contact_id', dbContact.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('whatsapp_conversations')
      .insert({
        contact_id: dbContact.id,
        agency_id: dbContact.agency_id,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    conversation = newConv;
  }

  if (!conversation) {
    logger.error({ contactId: dbContact.id }, 'Failed to create conversation');
    return;
  }

  // Store message
  const content =
    message.text?.body ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    message.button?.text ??
    `[${message.type}]`;

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversation.id,
    agency_id: dbContact.agency_id,
    direction: 'inbound',
    type: message.type,
    content,
    wa_message_id: message.id,
    status: 'delivered',
    metadata: { raw: message },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Route through conversation manager
  await conversationManager.handleMessage(
    dbContact.id,
    dbContact.agency_id,
    conversation.id,
    message,
  );
}

async function handleStatusUpdate(status: MessageStatus): Promise<void> {
  logger.debug(
    { messageId: status.id, status: status.status },
    'Message status update',
  );

  const supabase = getSupabaseClient();

  // Update message status
  await supabase
    .from('whatsapp_messages')
    .update({
      status: status.status,
      updated_at: new Date().toISOString(),
    })
    .eq('wa_message_id', status.id);

  // If it's a read receipt for a notice, update notice_deliveries
  if (status.status === 'read') {
    await supabase
      .from('notice_deliveries')
      .update({ read_at: new Date().toISOString() })
      .eq('wa_message_id', status.id)
      .is('read_at', null);
  }

  // Track delivery for notices
  if (status.status === 'delivered') {
    await supabase
      .from('notice_deliveries')
      .update({ delivered_at: new Date().toISOString() })
      .eq('wa_message_id', status.id)
      .is('delivered_at', null);
  }
}
