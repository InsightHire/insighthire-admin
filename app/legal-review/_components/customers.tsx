'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

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
    <section className="bg-white rounded-lg shadow p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Customers</h2>
      <p className="text-sm text-gray-500">
        Always on for demo tenants{demoOrgs.length ? ` (${demoOrgs.map((o) => o.name).join(', ')})` : ''}.{' '}
        {approved ? 'Enabled customers below can use it now.' : 'Enabled customers get it only after this review is approved.'} Changing this needs a super admin.
      </p>
      {enablements.length > 0 && (
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left py-2">Organization</th>
              <th className="text-left py-2">Enabled</th>
              <th className="text-left py-2">Live now</th>
              <th className="text-left py-2">Note</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enablements.map((e) => (
              <tr key={e.id}>
                <td className="py-2">
                  {e.organizationName} <span className="text-xs font-mono text-gray-400">{e.organizationId}</span>
                </td>
                <td className="py-2">{e.enabled ? 'Yes' : 'No'}</td>
                <td className="py-2">{e.demoTenant || (e.enabled && approved) ? 'Yes' : 'No'}</td>
                <td className="py-2 text-gray-600">{e.note ?? ''}</td>
                <td className="py-2 text-right">
                  <button onClick={() => toggle(e.organizationId, !e.enabled)} disabled={setOrg.isLoading} className="text-blue-600 hover:text-blue-700 text-sm">
                    {e.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an organization to enable" className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. signed agreement date)" className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {(search.data ?? []).length > 0 && (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {(search.data as Org[]).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span>{o.name}</span>
                <span className="text-xs font-mono text-gray-400">{o.id}</span>
                {o.demoTenant && <span className="text-xs text-gray-500">demo tenant</span>}
                <button onClick={() => toggle(o.id, true)} disabled={setOrg.isLoading} className="ml-auto text-blue-600 hover:text-blue-700">
                  Enable
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
