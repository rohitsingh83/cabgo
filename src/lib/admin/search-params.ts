import type { z, ZodTypeAny } from 'zod';

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Parse a page's `searchParams` with the same Zod schema the API uses.
 * Hand-edited URLs (`?page=abc`, `?status=nonsense`) fall back to the defaults instead of crashing the page.
 */
export function parseSearchParams<S extends ZodTypeAny>(schema: S, params: RawParams): z.output<S> {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) flat[key] = Array.isArray(value) ? value[0] : value;
  const parsed = schema.safeParse(flat);
  return parsed.success ? parsed.data : schema.parse({});
}
