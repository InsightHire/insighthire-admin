'use client';

import { useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SectionCard } from '@/components/admin/section-card';
import { StatusPill } from '@/components/admin/status-pill';
import { DataTableEl, Th, Td } from '@/components/admin/data-table';
import { buttonClass, inputClass } from '@/components/admin/controls';

type Enablement = { id: string; organizationId: string; organizationName: string; enabled: boolean; note: string | null; updatedAt: string; demoTenant: boolean };
type Org = { id: string; name: string; demoTenant?: boolean };

export function Customers({
  featureKey,
  approved,
  enablements,
  demoOrgs,
  onChange,
}: {
  featureKey: string;
  approved: boolean;
  enablements: Enablement[];
  demoOrgs: Org[];
  onChange: () => void;
}) {
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const search = (trpc as any).platformAdmin.legalReviewOrgSearch.useQuery({ q: q.trim() }, { enabled: q.trim().length >= 2, refetchOnWindowFocus: false });
  const setOrg = (trpc as any).platformAdmin.legalReviewSetOrg.useMutation({
    onSuccess: (r: { syncError: string | null }) => {
      setQ('');
      setNote('');
      onChange();
      if (r.syncError) alert(`Saved, but the VMS did not get the change: ${r.syncError}. Use "Re-sync VMS" on the Legal review page.`);
    },
    onError: (e: { message: string }) => alert(e.message),
  });
  const toggle = (organizationId: string, enabled: boolean) => setOrg.mutate({ key: featureKey, organizationId, enabled, note: note.trim() || null });

  return (
    <SectionCard
      icon={<Building2 />}
      title="Customers"
      description={
        <>
          Always on for demo tenants{demoOrgs.length ? ` (${demoOrgs.map((o) => o.name).join(', ')})` : ''}.{' '}
          {approved ? 'Enabled customers below can use it now.' : 'Enabled customers get it only after this review is approved.'} Changing this needs a super admin.
        </>
      }
      padded={false}
    >
      {enablements.length > 0 && (
        <div className="overflow-x-auto border-b border-admin-border">
          <DataTableEl>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th>Enabled</Th>
                <Th>Live now</Th>
                <Th>Note</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {enablements.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <span className="font-medium text-admin-ink">{e.organizationName}</span>{' '}
                    <span className="font-mono text-xs text-admin-muted">{e.organizationId}</span>
                  </Td>
                  <Td>
                    <StatusPill tone={e.enabled ? 'success' : 'neutral'}>{e.enabled ? 'Yes' : 'No'}</StatusPill>
                  </Td>
                  <Td>
                    {e.demoTenant || (e.enabled && approved) ? (
                      <StatusPill tone="success">Yes</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">No</StatusPill>
                    )}
                  </Td>
                  <Td>{e.note ?? ''}</Td>
                  <Td className="text-right">
                    <button onClick={() => toggle(e.organizationId, !e.enabled)} disabled={setOrg.isLoading} className={buttonClass.small}>
                      {e.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </div>
      )}
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-admin-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an organization to enable" className={`${inputClass} pl-9`} />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. signed agreement date)" className={`${inputClass} min-w-[220px] flex-1`} />
        </div>
        {(search.data ?? []).length > 0 && (
          <ul className="divide-y divide-admin-border overflow-hidden rounded-admin-sm border border-admin-border">
            {(search.data as Org[]).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium text-admin-ink">{o.name}</span>
                <span className="font-mono text-xs text-admin-muted">{o.id}</span>
                {o.demoTenant && <StatusPill tone="warn" dot={false}>demo tenant</StatusPill>}
                <button onClick={() => toggle(o.id, true)} disabled={setOrg.isLoading} className={`${buttonClass.small} ml-auto`}>
                  Enable
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
