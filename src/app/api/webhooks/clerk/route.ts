import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';

import { deleteUserByClerkId, normalizeWebhookUser, upsertUserFromClerk } from '@/lib/clerk-sync';

/**
 * Clerk → Supabase user sync.
 *
 * Clerk Dashboard → Webhooks → Add endpoint:
 *   URL:    https://<your-domain>/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted
 * Copy the signing secret into CLERK_WEBHOOK_SECRET.
 *
 * Local development: expose localhost with a tunnel (ngrok / Cloudflare Tunnel) or rely on the
 * lazy-sync fallback in `getCurrentUser()`.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
  }

  // 1. Verify the Svix signature against the RAW body.
  const headerList = headers();
  const svixId = headerList.get('svix-id');
  const svixTimestamp = headerList.get('svix-timestamp');
  const svixSignature = headerList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ success: false, error: 'Missing Svix headers' }, { status: 400 });
  }

  const payload = await request.text();

  let event: WebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.warn('[clerk-webhook] signature verification failed', error);
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 });
  }

  // 2. Handle the event. Returning non-2xx makes Clerk retry with backoff.
  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const user = await upsertUserFromClerk(normalizeWebhookUser(event.data));
        return NextResponse.json({ success: true, data: { id: user.id, event: event.type } });
      }

      case 'user.deleted': {
        if (event.data.id) await deleteUserByClerkId(event.data.id);
        return NextResponse.json({ success: true, data: { event: event.type } });
      }

      default:
        // Unsubscribed / unknown events are acknowledged so Clerk does not retry them.
        return NextResponse.json({ success: true, data: { ignored: event.type } });
    }
  } catch (error) {
    console.error(`[clerk-webhook] failed to process ${event.type}`, error);
    return NextResponse.json({ success: false, error: 'Failed to process event' }, { status: 500 });
  }
}
