import crypto from 'crypto';
import { config } from '../config';

/**
 * Verify the X-Hub-Signature-256 header sent by Meta on webhook POST requests.
 * Returns true if the HMAC-SHA256 of the raw body matches the provided signature.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!signature) return false;

  const expectedSig = crypto
    .createHmac('sha256', config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const expected = `sha256=${expectedSig}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Verify the webhook subscription challenge from Meta.
 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
 */
export function verifyWebhookSubscription(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
): { valid: boolean; challenge?: string } {
  if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
    return { valid: true, challenge: challenge ?? '' };
  }
  return { valid: false };
}
