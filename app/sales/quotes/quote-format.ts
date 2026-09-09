/** Display helpers shared by the tenant-quote list and detail pages. */

export const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-50 text-blue-700',
  VIEWED: 'bg-indigo-50 text-indigo-700',
  SIGNED: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-red-50 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  VOID: 'bg-gray-100 text-gray-500',
};

export function centsToMoney(amountCents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}
