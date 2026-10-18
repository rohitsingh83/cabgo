import { ok, parseOptionalBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { resolveSosAsAdmin } from '@/lib/admin/sos';
import { resolveSosAdminSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/sos/[id] — close an SOS alert after following up. */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  const admin = await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'alert id');
  await parseOptionalBody(request, resolveSosAdminSchema);
  return ok(await resolveSosAsAdmin(admin, id));
}, 'PATCH /api/admin/sos/[id]');
