import { getSupabaseClient } from '../db/client';
import { whatsappClient } from '../whatsapp/client';
import { messageRouter } from './router';
import type { InboundMessage } from '../whatsapp/types';
import { logger } from '../index';

export type ConversationState =
  | 'idle'
  | 'onboarding'
  | 'payment_collection'
  | 'complaint_handling'
  | 'screening'
  | 'maintenance_report'
  | 'awaiting_agent';

interface ConversationContext {
  state: ConversationState;
  data: Record<string, unknown>;
  lastMessageAt: string;
}

/**
 * Manages conversation state and message routing for each contact.
 * Implements a simple state machine for multi-step interactions.
 */
class ConversationManager {
  private contexts = new Map<string, ConversationContext>();

  /**
   * Handle an inbound message by routing it through the conversation state machine.
   */
  async handleMessage(
    contactId: string,
    agencyId: string,
    conversationId: string,
    message: InboundMessage,
  ): Promise<void> {
    const context = await this.getContext(contactId, conversationId);

    try {
      // Route the message based on current state and content
      const result = await messageRouter.route(
        message,
        context,
        contactId,
        agencyId,
        conversationId,
      );

      // Update context
      if (result.newState) {
        context.state = result.newState;
      }
      if (result.data) {
        context.data = { ...context.data, ...result.data };
      }
      context.lastMessageAt = new Date().toISOString();

      // Save context
      this.contexts.set(`${contactId}:${conversationId}`, context);
      await this.persistContext(conversationId, context);

      // Send response if any
      if (result.response) {
        await this.sendResponse(message.from, result.response, conversationId, agencyId);
      }

      // Check if we need to escalate to a human agent
      if (result.escalate) {
        await this.escalateToAgent(conversationId, agencyId, result.escalateReason);
      }
    } catch (error) {
      logger.error({ error, contactId, conversationId }, 'Error handling message');
      await whatsappClient.sendText(
        message.from,
        'We apologise for the inconvenience. Your message has been forwarded to an agent who will assist you shortly.',
      );
      await this.escalateToAgent(conversationId, agencyId, 'Error in automated handling');
    }
  }

  /**
   * Get the conversation context, loading from DB if not in memory.
   */
  private async getContext(
    contactId: string,
    conversationId: string,
  ): Promise<ConversationContext> {
    const cacheKey = `${contactId}:${conversationId}`;
    const cached = this.contexts.get(cacheKey);
    if (cached) return cached;

    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('context')
      .eq('id', conversationId)
      .single();

    const context: ConversationContext = {
      state: (data?.context as any)?.state ?? 'idle',
      data: (data?.context as any)?.data ?? {},
      lastMessageAt: new Date().toISOString(),
    };

    this.contexts.set(cacheKey, context);
    return context;
  }

  /**
   * Persist conversation context to the database.
   */
  private async persistContext(
    conversationId: string,
    context: ConversationContext,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('whatsapp_conversations')
      .update({ context })
      .eq('id', conversationId);
  }

  /**
   * Send a response and store it in the messages table.
   */
  private async sendResponse(
    to: string,
    response: string | { type: 'interactive'; body: string; buttons: Array<{ id: string; title: string }> },
    conversationId: string,
    agencyId: string,
  ): Promise<void> {
    let waMessageId: string | undefined;

    if (typeof response === 'string') {
      const result = await whatsappClient.sendText(to, response);
      waMessageId = result.messages?.[0]?.id;
    } else if (response.type === 'interactive') {
      const result = await whatsappClient.sendInteractiveButtons(
        to,
        response.body,
        response.buttons,
      );
      waMessageId = result.messages?.[0]?.id;
    }

    // Store outbound message
    const supabase = getSupabaseClient();
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      agency_id: agencyId,
      direction: 'outbound',
      type: 'text',
      content: typeof response === 'string' ? response : response.body,
      wa_message_id: waMessageId,
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Escalate a conversation to a human agent.
   */
  private async escalateToAgent(
    conversationId: string,
    agencyId: string,
    reason?: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('whatsapp_conversations')
      .update({
        status: 'pending_agent',
        context: { escalation_reason: reason },
      })
      .eq('id', conversationId);

    logger.info({ conversationId, agencyId, reason }, 'Conversation escalated to agent');
  }
}

export const conversationManager = new ConversationManager();
