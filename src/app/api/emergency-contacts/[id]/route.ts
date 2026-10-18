import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validations';

/** DELETE /api/emergency-contacts/[id] — only the owner can remove a contact. */
export const DELETE = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser(['rider', 'driver']);
  const id = parseParam(uuidSchema, params.id, 'contact id');
  const db = createSupabaseAdminClient();

  const { data, error } = await db.from('emergency_contacts').delete().eq('id', id).eq('user_id', user.id).select('id').maybeSingle();
  if (error) throw new Error(`Failed to delete emergency contact: ${error.message}`);
  if (!data) throw new ApiError(404, 'Contact not found.');
  return ok({ id: data.id });
});
