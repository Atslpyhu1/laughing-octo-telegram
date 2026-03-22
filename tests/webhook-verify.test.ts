import crypto from 'crypto';

// Mock config before importing
jest.mock('../src/config', () => ({
  config: {
    WHATSAPP_APP_SECRET: 'test_secret_key',
    WHATSAPP_VERIFY_TOKEN: 'test_verify_token',
  },
}));

import { verifyWebhookSignature, verifyWebhookSubscription } from '../src/webhook/verify';

describe('Webhook Signature Verification', () => {
  const secret = 'test_secret_key';

  test('should accept valid signature', () => {
    const body = Buffer.from('{"test":"data"}');
    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const signature = `sha256=${hash}`;

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  test('should reject invalid signature', () => {
    const body = Buffer.from('{"test":"data"}');
    const signature = 'sha256=invalid_hash_value_here_that_is_64_chars_long_aaaaaaaaaaaaaaaa';

    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });

  test('should reject empty signature', () => {
    const body = Buffer.from('{"test":"data"}');
    expect(verifyWebhookSignature(body, '')).toBe(false);
  });
});

describe('Webhook Subscription Verification', () => {
  test('should accept valid subscription', () => {
    const result = verifyWebhookSubscription('subscribe', 'test_verify_token', 'challenge_123');
    expect(result.valid).toBe(true);
    expect(result.challenge).toBe('challenge_123');
  });

  test('should reject wrong verify token', () => {
    const result = verifyWebhookSubscription('subscribe', 'wrong_token', 'challenge_123');
    expect(result.valid).toBe(false);
  });

  test('should reject wrong mode', () => {
    const result = verifyWebhookSubscription('unsubscribe', 'test_verify_token', 'challenge_123');
    expect(result.valid).toBe(false);
  });

  test('should reject missing parameters', () => {
    expect(verifyWebhookSubscription(undefined, undefined, undefined).valid).toBe(false);
  });
});
