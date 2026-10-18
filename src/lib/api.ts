import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';

import { auth as clerkAuth } from '@clerk/nextjs/server';

import { getCurrentUser } from '@/lib/auth';
import { checkRateLimit, clientIdentity, RATE_LIMITS, type RateLimitRule } from '@/lib/rate-limit';
import type { ApiFailure, ApiSuccess, User, UserRole } from '@/types';

/**
 * Shared helpers for Route Handlers: consistent JSON envelopes, auth guards,
 * Zod body/query parsing and centralised error handling.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly details?: Record<string, string[] | undefined>;

  constructor(status: number, message: string, details?: Record<string, string[] | undefined>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** 200/201 JSON envelope: `{ success: true, data }`. */
export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

/** Error JSON envelope: `{ success: false, error, details? }`. */
export function fail(
  message: string,
  status = 400,
  details?: Record<string, string[] | undefined>,
): NextResponse<ApiFailure> {
  return NextResponse.json({ success: false as const, error: message, details }, { status });
}

/**
 * Require a signed-in, active user (optionally restricted to certain roles).
 * @throws ApiError 401 (not signed in) | 403 (suspended / wrong role)
 */
export async function requireApiUser(roles?: readonly UserRole[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, 'You must be signed in');
  if (!user.is_active) throw new ApiError(403, 'Your account has been suspended');
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }
  return user;
}

/** Parse + validate a JSON body. @throws ApiError 400 with per-field details. */
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
  return validate(schema, raw);
}

/** Like `parseBody`, but an empty body is treated as `{}` (e.g. optional cancel reason). */
export async function parseOptionalBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.output<S>> {
  const text = await request.text();
  if (text.trim() === '') return validate(schema, {});
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
  return validate(schema, raw);
}

/** Validate a dynamic route segment (e.g. a UUID in `[id]`). @throws ApiError 400 */
export function parseParam<S extends ZodTypeAny>(schema: S, value: string, name = 'id'): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, `Invalid ${name}`);
  return result.data as z.output<S>;
}

/** Parse + validate URL search params (all values arrive as strings). */
export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return validate(schema, params);
}

function validate<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'Validation failed', flattenZodError(result.error));
  }
  return result.data as z.output<S>;
}

export function flattenZodError(error: ZodError): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

/** Convert any thrown value into a JSON error response (never leaks internals on 5xx). */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiFailure> {
  if (error instanceof ApiError) return fail(error.message, error.status, error.details);
  if (error instanceof ZodError) return fail('Validation failed', 400, flattenZodError(error));

  // Next.js uses thrown errors for control flow (dynamic rendering bail-out, redirect(), notFound()).
  // Swallowing them would break the framework, so let them propagate.
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String((error as { digest: unknown }).digest) : '';
  if (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
    throw error;
  }

  // Stripe SDK errors carry `type: 'StripeCardError' | 'StripeInvalidRequestError' | …`. They are upstream
  // failures (502), not bugs in our code, and their raw messages must not reach the browser.
  const stripeType = typeof error === 'object' && error !== null && 'type' in error ? String((error as { type: unknown }).type) : '';
  if (stripeType.startsWith('Stripe')) {
    console.error(`[api]${context ? ` ${context}` : ''} stripe error (${stripeType})`, error);
    return fail('Our payment provider could not process this request. Please try again in a moment.', 502);
  }

  console.error(`[api]${context ? ` ${context}` : ''}`, error);
  return fail('Something went wrong. Please try again.', 500);
}

type RouteContext<P> = { params: P };

interface WithApiOptions {
  /** Override the default bucket (reads: 180/min, writes: 60/min per user), or `false` to skip limiting. */
  rateLimit?: RateLimitRule | false;
}

/** Clerk user id from the session cookie/token, or null (never throws — limiting then falls back to the IP). */
function sessionUserId(): string | null {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  if (isDemo) return 'demo-user';
  try {
    return clerkAuth().userId;
  } catch {
    return null;
  }
}

/**
 * Wrap a route handler so thrown `ApiError`/`ZodError`s become proper responses and every call is rate limited
 * *before* any database work happens.
 *
 * ```ts
 * export const GET = withApi(async () => {
 *   const user = await requireApiUser(['rider']);
 *   return ok({ id: user.id });
 * });
 * export const POST = withApi(handler, 'POST /api/sos', { rateLimit: RATE_LIMITS.sos });
 * ```
 */
export function withApi<P = Record<string, string>>(
  handler: (request: Request, context: RouteContext<P>) => Promise<NextResponse>,
  label?: string,
  options: WithApiOptions = {},
) {
  return async (request: Request, context: RouteContext<P>): Promise<NextResponse> => {
    try {
      const rule = options.rateLimit === undefined ? (request.method === 'GET' || request.method === 'HEAD' ? RATE_LIMITS.read : RATE_LIMITS.write) : options.rateLimit;
      if (rule) {
        const result = await checkRateLimit(clientIdentity(request, sessionUserId()), rule);
        if (!result.allowed) {
          const limited = fail('Too many requests. Please slow down and try again shortly.', 429);
          limited.headers.set('Retry-After', String(result.retryAfterSec));
          limited.headers.set('X-RateLimit-Limit', String(result.limit));
          limited.headers.set('X-RateLimit-Remaining', '0');
          return limited;
        }
      }
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, label ?? `${request.method} ${new URL(request.url).pathname}`);
    }
  };
}
