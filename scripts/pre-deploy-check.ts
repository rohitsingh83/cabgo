/**
 * CabGo Deployment Pre-Flight Readiness Checker
 * Run with: npx tsx scripts/pre-deploy-check.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

interface ServiceStatus {
  name: string;
  category: 'core' | 'payments' | 'realtime' | 'maps' | 'notifications' | 'performance';
  required: boolean;
  configured: boolean;
  warning?: string;
  details?: string;
}

function checkPlaceholder(val?: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    !lower.includes('replace_me') &&
    !lower.includes('your-project') &&
    !lower.includes('xxxxxxxx') &&
    val.trim().length > 0
  );
}

function runCheck() {
  console.log('\n======================================================');
  console.log('       CabGo — Market Deployment Readiness Check     ');
  console.log('======================================================\n');

  const services: ServiceStatus[] = [
    {
      name: 'Clerk Authentication',
      category: 'core',
      required: true,
      configured:
        checkPlaceholder(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
        checkPlaceholder(process.env.CLERK_SECRET_KEY),
      details: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')
        ? 'LIVE Mode'
        : 'TEST Mode',
      warning:
        !checkPlaceholder(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
          ? 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY contains placeholder values'
          : undefined,
    },
    {
      name: 'Clerk Webhook Sync',
      category: 'core',
      required: true,
      configured: checkPlaceholder(process.env.CLERK_WEBHOOK_SECRET),
      warning: !checkPlaceholder(process.env.CLERK_WEBHOOK_SECRET)
        ? 'CLERK_WEBHOOK_SECRET not set. Required for reliable user syncing.'
        : undefined,
    },
    {
      name: 'Supabase Postgres & Storage',
      category: 'core',
      required: true,
      configured:
        checkPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        checkPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY),
      details: process.env.NEXT_PUBLIC_SUPABASE_URL,
      warning:
        !checkPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL)
          ? 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY contains placeholder values'
          : undefined,
    },
    {
      name: 'Realtime Server Secret',
      category: 'realtime',
      required: true,
      configured:
        Boolean(process.env.REALTIME_INTERNAL_SECRET) &&
        process.env.REALTIME_INTERNAL_SECRET !== 'dev-internal-secret-change-me' &&
        (process.env.REALTIME_INTERNAL_SECRET?.length ?? 0) >= 16,
      warning:
        process.env.REALTIME_INTERNAL_SECRET === 'dev-internal-secret-change-me'
          ? 'Using default dev secret. Change to a long random string for production!'
          : undefined,
    },
    {
      name: 'Socket.IO Realtime URL',
      category: 'realtime',
      required: true,
      configured: checkPlaceholder(process.env.NEXT_PUBLIC_SOCKET_URL),
      details: process.env.NEXT_PUBLIC_SOCKET_URL,
    },
    {
      name: 'Stripe Payments',
      category: 'payments',
      required: true,
      configured:
        checkPlaceholder(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
        checkPlaceholder(process.env.STRIPE_SECRET_KEY),
      details: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_')
        ? 'LIVE Mode'
        : 'TEST Mode',
      warning:
        !checkPlaceholder(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
          ? 'Stripe keys are placeholders. In-app credit card payments will fail.'
          : undefined,
    },
    {
      name: 'Stripe Webhook Secret',
      category: 'payments',
      required: true,
      configured: checkPlaceholder(process.env.STRIPE_WEBHOOK_SECRET),
      warning: !checkPlaceholder(process.env.STRIPE_WEBHOOK_SECRET)
        ? 'STRIPE_WEBHOOK_SECRET is unset. Asynchronous payment confirmation requires webhooks.'
        : undefined,
    },
    {
      name: 'Google Maps Platform',
      category: 'maps',
      required: false,
      configured: checkPlaceholder(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
      details: checkPlaceholder(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
        ? 'Enabled (Google Places & Directions)'
        : 'Fallback Mode (Built-in Hyderabad Places & Straight-line Route)',
      warning: !checkPlaceholder(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
        ? 'Optional: Using fallback mock places. Provide Google Maps API key for production.'
        : undefined,
    },
    {
      name: 'Firebase Realtime Fallback',
      category: 'realtime',
      required: false,
      configured: checkPlaceholder(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      details: checkPlaceholder(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
        ? 'Enabled'
        : 'Disabled (Sockets only, no Firebase mirror)',
    },
    {
      name: 'Email Service (Resend/SMTP)',
      category: 'notifications',
      required: false,
      configured:
        Boolean(process.env.RESEND_API_KEY && checkPlaceholder(process.env.RESEND_API_KEY)) ||
        Boolean(process.env.SMTP_USER),
      details: process.env.RESEND_API_KEY ? 'Resend API' : process.env.SMTP_USER ? 'SMTP' : 'Disabled (Receipts generated in-app only)',
    },
    {
      name: 'Twilio (Emergency SOS SMS)',
      category: 'notifications',
      required: false,
      configured: checkPlaceholder(process.env.TWILIO_ACCOUNT_SID),
      details: checkPlaceholder(process.env.TWILIO_ACCOUNT_SID) ? 'Enabled' : 'Disabled (In-app and live admin alerts only)',
    },
    {
      name: 'Upstash Redis Rate Limiting',
      category: 'performance',
      required: false,
      configured: checkPlaceholder(process.env.UPSTASH_REDIS_REST_URL),
      details: checkPlaceholder(process.env.UPSTASH_REDIS_REST_URL) ? 'Distributed Redis' : 'In-Memory (Single-instance)',
    },
  ];

  let coreConfiguredCount = 0;
  let coreTotal = 0;

  console.log('Status Report:\n');
  for (const s of services) {
    if (s.required) coreTotal++;
    if (s.required && s.configured) coreConfiguredCount++;

    const icon = s.configured ? '✅' : s.required ? '❌' : '⚠️ ';
    const reqTag = s.required ? '[CRITICAL]' : '[OPTIONAL]';
    console.log(`${icon} ${s.name.padEnd(30)} ${reqTag.padEnd(12)} ${s.details || (s.configured ? 'Configured' : 'Missing')}`);
    if (s.warning) {
      console.log(`   └─ Note: ${s.warning}`);
    }
  }

  console.log('\n------------------------------------------------------');
  if (coreConfiguredCount === coreTotal) {
    console.log('🎉 ALL CORE INTEGRATIONS ARE CONFIGURED FOR PRODUCTION!');
    console.log('   The application is fully ready for market deployment.');
  } else {
    console.log(`ℹ️  Local Development / Demo Mode: ${coreConfiguredCount}/${coreTotal} core services configured with real keys.`);
    console.log('   The app will run in local mock/fallback mode.');
    console.log('   To go live to the market, replace placeholders in .env.local and server/.env.');
  }
  console.log('------------------------------------------------------\n');
}

runCheck();
