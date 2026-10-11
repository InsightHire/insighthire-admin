export const STATUSES = ['NEEDS_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const;

export const STATUS_LABEL: Record<string, string> = {
  NEEDS_REVIEW: 'Needs review',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const STATUS_TONE: Record<string, string> = {
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export const EVENT_LABEL: Record<string, string> = {
  status_changed: 'Status changed',
  details_updated: 'Details updated',
  org_enabled: 'Customer enabled',
  org_disabled: 'Customer disabled',
  document_added: 'Document added',
  document_removed: 'Document removed',
};

export const dollars = (cents: number | null | undefined) =>
  cents == null ? '—' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const percent = (bps: number) => `${(bps / 100).toFixed(2)}%`;
