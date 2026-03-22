import { config, WHATSAPP_API_BASE } from '../config';
import { logger } from '../index';
import { rateLimiter } from './rate-limiter';
import type {
  OutboundMessage,
  SendTextMessage,
  SendTemplateMessage,
  SendInteractiveMessage,
  SendMessageResponse,
  TemplateComponent,
} from './types';

/**
 * WhatsApp Cloud API client for sending messages.
 */
export class WhatsAppClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.baseUrl = WHATSAPP_API_BASE;
    this.accessToken = config.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  }

  private get messagesUrl(): string {
    return `${this.baseUrl}/${this.phoneNumberId}/messages`;
  }

  /**
   * Send a raw message payload to the WhatsApp API.
   */
  async sendRaw(payload: OutboundMessage): Promise<SendMessageResponse> {
    await rateLimiter.acquire();

    const response = await fetch(this.messagesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody },
        'WhatsApp API error',
      );
      throw new Error(`WhatsApp API error: ${response.status} — ${errorBody}`);
    }

    const data = (await response.json()) as SendMessageResponse;
    logger.info(
      { messageId: data.messages?.[0]?.id, to: (payload as any).to },
      'Message sent successfully',
    );
    return data;
  }

  /**
   * Send a text message.
   */
  async sendText(to: string, body: string, previewUrl = false): Promise<SendMessageResponse> {
    const payload: SendTextMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: previewUrl, body },
    };
    return this.sendRaw(payload);
  }

  /**
   * Send a template message.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en_ZA',
    components?: TemplateComponent[],
  ): Promise<SendMessageResponse> {
    const payload: SendTemplateMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    };
    return this.sendRaw(payload);
  }

  /**
   * Send an interactive button message.
   */
  async sendInteractiveButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string,
  ): Promise<SendMessageResponse> {
    const payload: SendInteractiveMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(header ? { header: { type: 'text', text: header } } : {}),
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply' as const,
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };
    return this.sendRaw(payload);
  }

  /**
   * Send an interactive list message.
   */
  async sendInteractiveList(
    to: string,
    body: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    header?: string,
    footer?: string,
  ): Promise<SendMessageResponse> {
    const payload: SendInteractiveMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(header ? { header: { type: 'text', text: header } } : {}),
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          button: buttonText,
          sections,
        },
      },
    };
    return this.sendRaw(payload);
  }

  /**
   * Mark a message as read.
   */
  async markAsRead(messageId: string): Promise<void> {
    await rateLimiter.acquire();

    await fetch(this.messagesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }
}

/** Singleton WhatsApp client instance */
export const whatsappClient = new WhatsAppClient();
