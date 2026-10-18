import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';

/**
 * Run an admin API call and report the outcome.
 * Returns `null` on success or the error message — the shape `ConfirmReasonDialog.onConfirm` expects.
 */
export async function runAdminAction(
  request: () => Promise<unknown>,
  success: { title: string; description?: string },
): Promise<string | null> {
  try {
    await request();
    toast({ variant: 'success', ...success });
    return null;
  } catch (error) {
    return error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.';
  }
}

export { apiFetch };
