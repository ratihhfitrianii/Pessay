import { z } from 'zod';

/**
 * Env validation — fail-fast di produksi, default aman di dev/test.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/pessay'),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  JWT_SECRET: z.string().min(16).default('pessay-dev-secret-change-me-123456'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  REDIS_URL: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('*'),
  GRADING_MODE: z.enum(['mock', 'real']).default('mock'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GRADING_BATCH_SIZE: z.coerce.number().default(10),
  GRADING_INTERVAL_MS: z.coerce.number().default(10000),
  GRADING_MAX_CONCURRENCY: z.coerce.number().default(3),
  RATE_LIMIT_SUBMIT_PER_10S: z.coerce.number().default(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[env] Konfigurasi lingkungan tidak valid:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;