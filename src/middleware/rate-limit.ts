import rateLimit from 'express-rate-limit';

/**
 * Express rate limiter for API endpoints.
 * Configured to prevent abuse while allowing normal operation.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests — please try again later',
    retry_after_seconds: 60,
  },
  keyGenerator: (req) => {
    // Use API key or IP as the rate limit key
    return (req.headers['x-api-key'] as string) ?? req.ip ?? 'unknown';
  },
});

/**
 * Stricter rate limiter for bulk operations.
 */
export const bulkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 bulk sends per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bulk send rate limit exceeded — please try again later',
    retry_after_seconds: 60,
  },
});
