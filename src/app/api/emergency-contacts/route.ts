import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { listEmergencyContacts } from '@/lib/safety/sos';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { emergencyContactSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_CONTACTS = 5;

/** GET /api/emergency-contacts — the caller's contacts (oldest first). */
export const GET = withApi(async () => {
  const user = await requireApiUser(['rider', 'driver']);
  return ok(await listEmergencyContacts(user.id));
});

/** POST /api/emergency-contacts  { name, phone, relationship? } — max 5; the same number twice is rejected. */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const input = await parseBody(request, emergencyContactSchema);
  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from('emergency_contacts')
    .insert({ user_id: user.id, name: input.name, phone: input.phone, relationship: input.relationship })
    .select('*')
    .single();

  if (error || !data) {
    if (error?.code === '23505') throw new ApiError(409, 'That number is already one of your emergency contacts.', { phone: ['Already saved'] });
    // 23514 = the DB trigger that caps contacts at 5.
    if (error?.code === '23514') throw new ApiError(409, `You can save up to ${MAX_CONTACTS} emergency contacts. Remove one first.`);
    throw new Error(`Failed to save emergency contact: ${error?.message ?? 'no row returned'}`);
  }
  return ok(data, 201);
}, 'POST /api/emergency-contacts', { rateLimit: RATE_LIMITS.content });
