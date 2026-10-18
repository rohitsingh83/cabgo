import type { ReceiptData } from '@/types';
import { methodLabel } from '@/lib/payments/format';
import { formatCurrency } from '@/lib/utils';

/** Escape user-controlled strings (addresses, names) before they enter HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Lines of the fare table; zero-valued optional lines are hidden. */
export function receiptLines(
  receipt: ReceiptData,
): { label: string; amount: number; tone?: 'discount' }[] {
  const b = receipt.breakdown;
  if (receipt.kind === 'cancellation_fee' || !b) {
    return [
      {
        label: receipt.kind === 'cancellation_fee' ? 'Late cancellation fee' : 'Ride fare',
        amount: receipt.total,
      },
    ];
  }
  const lines: { label: string; amount: number; tone?: 'discount' }[] = [
    { label: 'Base fare', amount: b.baseFare },
    { label: 'Distance', amount: b.distanceFare },
    { label: 'Time', amount: b.timeFare },
  ];
  if (b.stopsFee > 0) lines.push({ label: 'Extra stops', amount: b.stopsFee });
  if (b.surgeAmount > 0) lines.push({ label: 'Surge pricing', amount: b.surgeAmount });
  lines.push({ label: 'Booking fee', amount: b.bookingFee });
  if (b.tax > 0) lines.push({ label: 'Taxes', amount: b.tax });
  if (b.discount > 0)
    lines.push({ label: 'Promo discount', amount: -b.discount, tone: 'discount' });
  return lines;
}

/**
 * A complete, self-contained HTML receipt. Table layout + inline CSS only, because the same markup is
 * used as the email body (mail clients ignore <style> blocks and flexbox) and as the downloadable file.
 */
export function renderReceiptHtml(receipt: ReceiptData, options: { appUrl?: string } = {}): string {
  const money = (amount: number) =>
    amount < 0
      ? `−${formatCurrency(Math.abs(amount), receipt.currency)}`
      : formatCurrency(amount, receipt.currency);
  const lines = receiptLines(receipt)
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;font-size:14px;color:#525252;">${esc(line.label)}</td>
        <td align="right" style="padding:8px 0;font-size:14px;font-weight:600;color:${line.tone === 'discount' ? '#16a34a' : '#0a0a0a'};">${money(line.amount)}</td>
      </tr>`,
    )
    .join('');

  const stops = receipt.ride.stops
    .map(
      (stop) => `<div style="font-size:13px;color:#737373;margin-top:6px;">via ${esc(stop)}</div>`,
    )
    .join('');
  const statusColor =
    receipt.status === 'completed'
      ? '#16a34a'
      : receipt.status === 'refunded'
        ? '#2563eb'
        : '#d97706';
  const statusText =
    receipt.status === 'completed'
      ? 'Paid'
      : receipt.status === 'refunded'
        ? 'Refunded'
        : receipt.status === 'failed'
          ? 'Payment failed'
          : 'Payment pending';
  const link = options.appUrl
    ? `<p style="margin:24px 0 0;font-size:13px;color:#737373;">View this receipt any time in <a href="${esc(options.appUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600;">your CabGo payments</a>.</p>`
    : '';
  const stripeLink = receipt.stripeReceiptUrl
    ? `<p style="margin:8px 0 0;font-size:13px;color:#737373;"><a href="${esc(receipt.stripeReceiptUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Payment confirmation from Stripe</a></p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CabGo receipt ${esc(receipt.number)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:'Plus Jakarta Sans',Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e5e5;">
  <tr>
    <td style="background:#0a0a0a;padding:28px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Cab<span style="color:#2563eb;">Go</span></td>
        <td align="right"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${statusColor};color:#ffffff;font-size:12px;font-weight:700;">${statusText}</span></td>
      </tr></table>
      <div style="margin-top:22px;font-size:13px;color:#a3a3a3;">${receipt.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Total paid'}</div>
      <div style="margin-top:4px;font-size:40px;font-weight:800;letter-spacing:-1px;color:#ffffff;">${money(receipt.total)}</div>
      <div style="margin-top:6px;font-size:13px;color:#a3a3a3;">${esc(dateFormatter.format(new Date(receipt.issuedAt)))} · ${esc(methodLabel(receipt.method))}</div>
    </td>
  </tr>
  <tr><td style="padding:24px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="22" valign="top" style="padding-top:4px;"><span style="display:block;width:10px;height:10px;border-radius:50%;background:#22c55e;"></span></td>
        <td style="font-size:14px;font-weight:600;line-height:1.4;">${esc(receipt.ride.pickup)}</td>
      </tr>
      <tr><td></td><td style="padding:8px 0 8px;">${stops}</td></tr>
      <tr>
        <td width="22" valign="top" style="padding-top:4px;"><span style="display:block;width:10px;height:10px;border-radius:2px;background:#0a0a0a;"></span></td>
        <td style="font-size:14px;font-weight:600;line-height:1.4;">${esc(receipt.ride.dropoff)}</td>
      </tr>
    </table>
    <div style="margin-top:14px;font-size:13px;color:#737373;">${esc(receipt.ride.vehicleLabel)} · ${receipt.ride.distanceKm.toFixed(1)} km · ${Math.max(1, Math.round(receipt.ride.durationMinutes))} min${receipt.driver ? ` · Driver ${esc(receipt.driver.name)}${receipt.driver.vehicle ? ` (${esc(receipt.driver.vehicle)})` : ''}` : ''}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 0;"><div style="height:1px;background:#e5e5e5;"></div></td></tr>
  <tr><td style="padding:12px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}
      <tr><td colspan="2" style="padding-top:6px;"><div style="height:1px;background:#e5e5e5;"></div></td></tr>
      <tr>
        <td style="padding:14px 0 0;font-size:16px;font-weight:800;">Total</td>
        <td align="right" style="padding:14px 0 0;font-size:20px;font-weight:800;">${money(receipt.total)}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 28px 28px;">
    <div style="font-size:12px;color:#a3a3a3;">Receipt ${esc(receipt.number)} · Billed to ${esc(receipt.rider.name)}</div>
    ${stripeLink}${link}
  </td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:12px;color:#a3a3a3;">Thanks for riding with CabGo.</p>
</body>
</html>`;
}

/** Plain-text alternative for the email (improves deliverability and accessibility). */
export function renderReceiptText(receipt: ReceiptData): string {
  const money = (amount: number) => formatCurrency(amount, receipt.currency);
  return [
    `CabGo receipt ${receipt.number}`,
    `${receipt.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Total paid'}: ${money(receipt.total)} (${methodLabel(receipt.method)})`,
    '',
    `From: ${receipt.ride.pickup}`,
    `To:   ${receipt.ride.dropoff}`,
    '',
    ...receiptLines(receipt).map(
      (line) => `${line.label}: ${line.amount < 0 ? '-' : ''}${money(Math.abs(line.amount))}`,
    ),
    `Total: ${money(receipt.total)}`,
    '',
    'Thanks for riding with CabGo.',
  ].join('\n');
}
