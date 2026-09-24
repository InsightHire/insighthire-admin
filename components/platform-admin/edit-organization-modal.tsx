'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';

export const ORG_INDUSTRY_OPTIONS = [
  'TECHNOLOGY', 'HEALTHCARE', 'FINANCE', 'EDUCATION', 'RETAIL', 'MANUFACTURING',
  'CONSULTING', 'MARKETING', 'SALES', 'HUMAN_RESOURCES', 'LEGAL', 'REAL_ESTATE',
  'HOSPITALITY', 'TRANSPORTATION', 'ENERGY', 'MEDIA', 'NONPROFIT', 'GOVERNMENT', 'OTHER',
] as const;

export const ORG_SIZE_OPTIONS = [
  { value: 'STARTUP', label: 'Startup (1-10)' },
  { value: 'SMALL', label: 'Small (11-50)' },
  { value: 'MEDIUM', label: 'Medium (51-200)' },
  { value: 'LARGE', label: 'Large (201-1000)' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)' },
] as const;

type OrgEditSeed = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string;
  size: string;
  website?: string | null;
  deletedAt?: string | Date | null;
};

export function EditOrganizationModal({
  organizationId,
  open,
  onClose,
  onSaved,
  seed,
}: {
  organizationId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  seed?: OrgEditSeed | null;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('TECHNOLOGY');
  const [size, setSize] = useState('SMALL');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = trpc.platformAdmin.getOrganization.useQuery(
    { id: organizationId! },
    { enabled: open && !!organizationId },
  );

  const org = data?.organization ?? seed;
  const isArchived = Boolean(org?.deletedAt);

  useEffect(() => {
    if (!open) return;
    const source = data?.organization ?? seed;
    if (!source) return;
    setName(source.name ?? '');
    setDomain(source.domain ?? '');
    setIndustry(source.industry || 'TECHNOLOGY');
    setSize(source.size || 'SMALL');
    setWebsite(source.website ?? '');
    setError(null);
  }, [open, organizationId, data?.organization, seed]);

  const updateOrganization = trpc.platformAdmin.updateOrganization.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const handleSave = () => {
    if (!organizationId) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    updateOrganization.mutate({
      organizationId,
      name: name.trim(),
      domain: domain.trim() || null,
      industry: industry as (typeof ORG_INDUSTRY_OPTIONS)[number],
      size: size as (typeof ORG_SIZE_OPTIONS)[number]['value'],
      website: website.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg" open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogHeader>
          <DialogTitle>Edit organization</DialogTitle>
        </DialogHeader>

        {isLoading && !seed ? (
          <p className="py-8 text-center text-sm text-admin-secondary">Loading…</p>
        ) : isArchived ? (
          <p className="text-sm text-admin-secondary">Archived organizations cannot be edited here.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-admin-secondary">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-admin-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-admin-secondary">Domain</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                className="w-full rounded-lg border border-admin-border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-admin-muted">
                Unique tenant identity. Does not change the public careers slug.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-admin-secondary">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
                >
                  {ORG_INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-admin-secondary">Company size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
                >
                  {ORG_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-admin-secondary">Website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
                className="w-full rounded-lg border border-admin-border px-3 py-2 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-admin-danger">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-admin-border px-4 py-2 text-sm font-medium text-admin-secondary hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateOrganization.isLoading}
                className="rounded-lg bg-admin-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updateOrganization.isLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
