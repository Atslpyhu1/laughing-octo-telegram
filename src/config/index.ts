import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  WHATSAPP_API_VERSION: z.string().default('v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_VERIFY_TOKEN: z.string(),
  WHATSAPP_APP_SECRET: z.string(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_ANON_KEY: z.string(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  API_KEY: z.string(),
  JWT_SECRET: z.string(),

  STORAGE_BUCKET: z.string().default('notices'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const WHATSAPP_API_BASE = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}`;

/** Maximum messages per second allowed by WhatsApp Business API */
export const WHATSAPP_RATE_LIMIT = 80;

/** Bulk message batch size */
export const BULK_BATCH_SIZE = 50;
