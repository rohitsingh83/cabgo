import type { ApiResponse } from '@/types';

/**
 * Thin typed wrapper around `fetch` for our `{ success, data | error }` API envelope.
 * Components call `apiFetch<T>()` and get `T` back, or an `ApiClientError` with the
 * server's message (and per-field errors for forms) to show in a toast / inline.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly details?: Record<string, string[] | undefined>;

  constructor(message: string, status: number, details?: Record<string, string[] | undefined>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance !== null &&
      typeof instance === 'object' &&
      (('name' in (instance as Record<string, unknown>) && (instance as Record<string, unknown>).name === 'ApiClientError') ||
        Object.prototype.isPrototypeOf.call(ApiClientError.prototype, instance))
    );
  }
}

export function isApiClientError(err: unknown): err is ApiClientError {
  return (
    err instanceof ApiClientError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ApiClientError')
  );
}


interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Plain object → JSON; FormData is sent untouched. */
  body?: unknown;
}

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError('Network error — check your connection and try again.', 0);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON response (proxy error page etc.) — handled below.
  }

  if (!payload) {
    throw new ApiClientError(`Unexpected response from server (${response.status})`, response.status);
  }
  if (!payload.success) {
    throw new ApiClientError(payload.error, response.status, payload.details);
  }
  return payload.data;
}
