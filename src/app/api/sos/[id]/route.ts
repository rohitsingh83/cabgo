import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { resolveOwnSos } from '@/lib/safety/sos';
import { resolveSosSchema, uuidSchema } from '@/lib/validations';

/** PATCH /api/sos/[id]  { action: "resolve" } — "I'm safe": the owner closes their own alert. */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser(['rider', 'driver']);
  const id = parseParam(uuidSchema, params.id, 'alert id');
  await parseBody(request, resolveSosSchema);
  return ok(await resolveOwnSos(user, id));
});
