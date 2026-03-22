import { WHATSAPP_RATE_LIMIT } from '../config';

/**
 * Token-bucket rate limiter for WhatsApp Cloud API.
 * WhatsApp Business API allows up to 80 messages per second.
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private readonly waitQueue: Array<() => void> = [];

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Acquire a token. Resolves when a token is available.
   * This ensures we never exceed the WhatsApp rate limit.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token becomes available
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
      this.scheduleRefill();
    });
  }

  private scheduleRefill(): void {
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    setTimeout(() => {
      this.refill();
      while (this.tokens >= 1 && this.waitQueue.length > 0) {
        this.tokens -= 1;
        const resolve = this.waitQueue.shift();
        resolve?.();
      }
      if (this.waitQueue.length > 0) {
        this.scheduleRefill();
      }
    }, waitMs);
  }

  /** Current number of available tokens */
  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

export const rateLimiter = new TokenBucketRateLimiter(WHATSAPP_RATE_LIMIT);
