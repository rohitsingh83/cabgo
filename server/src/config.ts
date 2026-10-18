import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  REALTIME_INTERNAL_SECRET: z.string().min(16, 'REALTIME_INTERNAL_SECRET must be at least 16 characters'),
  FIREBASE_DATABASE_URL: optionalString,
  FIREBASE_ADMIN_PROJECT_ID: optionalString,
  FIREBASE_ADMIN_CLIENT_EMAIL: optionalString,
  FIREBASE_ADMIN_PRIVATE_KEY: optionalString,
});

export interface FirebaseAdminConfig {
  databaseUrl: string;
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  clerkSecretKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  internalSecret: string;
  /** Present only when every Firebase variable is set. */
  firebase: FirebaseAdminConfig | null;
}

/**
 * Validate the environment once at boot. A misconfigured server should refuse to start
 * with a readable list of problems instead of failing on the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Allow reusing the Next.js variable name for the Supabase URL.
  const parsed = envSchema.safeParse({
    ...env,
    SUPABASE_URL: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    FIREBASE_DATABASE_URL: env.FIREBASE_DATABASE_URL ?? env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });

  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid realtime server configuration:\n${lines.join('\n')}`);
  }
  const e = parsed.data;

  const firebase =
    e.FIREBASE_DATABASE_URL && e.FIREBASE_ADMIN_PROJECT_ID && e.FIREBASE_ADMIN_CLIENT_EMAIL && e.FIREBASE_ADMIN_PRIVATE_KEY
      ? {
          databaseUrl: e.FIREBASE_DATABASE_URL,
          projectId: e.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL,
          // Hosting dashboards store the key with literal "\n" sequences.
          privateKey: e.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
      : null;

  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    clerkSecretKey: e.CLERK_SECRET_KEY,
    supabaseUrl: e.SUPABASE_URL,
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    internalSecret: e.REALTIME_INTERNAL_SECRET,
    firebase,
  };
}
