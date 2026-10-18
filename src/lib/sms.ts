import 'server-only';

/**
 * Minimal Twilio SMS client over the REST API (no SDK needed for one endpoint).
 * Everything is optional: with no credentials `isSmsConfigured()` is false and callers degrade gracefully.
 */
const looksReal = (value: string | undefined, pattern: RegExp): value is string =>
  Boolean(value) && pattern.test(value as string) && !/x{6,}/i.test(value as string);

/**
 * Twilio needs E.164 (`+919876543210`). Riders often type local numbers (`98765 43210`), so a bare
 * 10-digit number gets the default country code; anything else just gets a leading `+`.
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  const country = (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE ?? '+91').replace(/[^\d+]/g, '');
  return digits.length === 10 ? `${country}${digits}` : `+${digits}`;
}

export function isSmsConfigured(): boolean {
  return (
    looksReal(process.env.TWILIO_ACCOUNT_SID, /^AC[0-9a-fA-F]{32}$/) &&
    looksReal(process.env.TWILIO_AUTH_TOKEN, /^[0-9a-zA-Z]{32}$/) &&
    looksReal(process.env.TWILIO_FROM_NUMBER, /^(\+[1-9]\d{7,14}|MG[0-9a-fA-F]{32})$/) &&
    process.env.TWILIO_FROM_NUMBER !== '+10000000000'
  );
}

/** Send one SMS. Never throws; resolves `true` only when Twilio accepted the message. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!isSmsConfigured()) return false;

  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const from = process.env.TWILIO_FROM_NUMBER as string;
  const params = new URLSearchParams({ To: toE164(to), Body: body });
  // A Messaging Service SID (MG…) is passed differently from a plain number.
  params.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[sms] Twilio rejected message (${response.status}):`, (await response.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[sms] request failed:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
