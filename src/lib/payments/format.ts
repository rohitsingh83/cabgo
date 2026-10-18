const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  wallet: 'Wallet',
  cash: 'Cash',
  netbanking: 'Net banking',
  link: 'Link',
};

/** Human label for Stripe's payment-method type (`upi` → "UPI", `card` → "Card"). */
export function methodLabel(method: string): string {
  return (
    METHOD_LABEL[method] ?? method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ')
  );
}
