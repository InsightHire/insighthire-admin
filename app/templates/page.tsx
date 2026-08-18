'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { PageHeader } from '@/components/admin/page-header';
import { FilterBar, FilterInput, FilterSelect } from '@/components/admin/filter-bar';
import { DataTable, DataTableEl, Td, Th } from '@/components/admin/data-table';
import { SeverityBadge } from '@/components/admin/severity-badge';
import { EmptyState } from '@/components/admin/empty-state';

type KindFilter = 'all' | 'interview' | 'assessment';

function formatWhen(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function kindBadge(kind: 'interview' | 'assessment') {
  return kind === 'interview' ? (
    <SeverityBadge severity="info">Interview</SeverityBadge>
  ) : (
    <SeverityBadge severity="ok">Assessment</SeverityBadge>
  );
}

function statusSeverity(status: string): 'ok' | 'warn' | 'critical' | 'muted' | 'info' {
  switch (status) {
    case 'ACTIVE':
    case 'PUBLISHED':
      return 'ok';
    case 'DRAFT':
      return 'info';
    case 'INACTIVE':
    case 'ARCHIVED':
      return 'muted';
    default:
      return 'muted';
  }
}

export default function TemplatesPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [includeSystem, setIncludeSystem] = useState(false);

  const { data, isLoading, error } = trpc.platformAdmin.listRecentTemplates.useQuery(
    {
      kind,
      limit: 100,
      search: search.trim() || undefined,
      includeSystem,
    },
    { enabled: !authLoading, context: { skipBatch: true } },
  );

  const templates = useMemo(() => data?.templates ?? [], [data]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Content"
        title="Recent templates"
        description="Interview and assessment templates created across tenants — with which positions use them."
      />

      <FilterBar>
        <FilterSelect
          label="Kind"
          value={kind}
          onChange={(v) => setKind(v as KindFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'interview', label: 'Interview' },
            { value: 'assessment', label: 'Assessment' },
          ]}
        />
        <FilterInput
          label="Search"
          value={search}
          onChange={setSearch}
          placeholder="Title or tenant…"
        />
        <label className="flex items-center gap-2 text-xs text-admin-muted">
          <input
            type="checkbox"
            checked={includeSystem}
            onChange={(e) => setIncludeSystem(e.target.checked)}
            className="rounded border-admin-border text-admin-accent focus:ring-admin-accent"
          />
          Include system templates
        </label>
      </FilterBar>

      {error ? (
        <div className="mb-4 rounded-admin border border-admin-danger/30 bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="admin-panel py-16 text-center text-sm text-admin-muted">Loading…</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No templates found"
          description="Try widening the kind filter or including system templates."
        />
      ) : (
        <DataTable>
          <DataTableEl>
            <thead>
              <tr>
                <Th>Kind</Th>
                <Th>Title</Th>
                <Th>Tenant</Th>
                <Th>Positions</Th>
                <Th>Status</Th>
                <Th>Questions</Th>
                <Th>Created by</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border bg-white">
              {templates.map((row: any) => (
                <tr key={`${row.kind}-${row.id}`} className="hover:bg-slate-50/80">
                  <Td>{kindBadge(row.kind)}</Td>
                  <Td>
                    <div className="font-medium text-admin-ink">{row.title}</div>
                    <div className="mt-0.5 text-xs text-admin-muted">
                      {row.subtype}
                      {row.isSystemTemplate ? ' · system' : ''}
                    </div>
                  </Td>
                  <Td>
                    {row.organization ? (
                      <Link
                        href={`/organizations/${row.organization.id}`}
                        className="font-medium text-admin-accent hover:underline"
                      >
                        {row.organization.name || row.organization.slug || row.organization.id}
                      </Link>
                    ) : (
                      <span className="text-admin-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    {row.positions.length === 0 ? (
                      <span className="text-admin-muted">Unassigned</span>
                    ) : (
                      <div className="flex max-w-xs flex-col gap-0.5">
                        {row.positions.slice(0, 3).map((p: any) => (
                          <span key={p.id} className="truncate text-admin-ink" title={p.title}>
                            {p.title}
                            <span className="ml-1 text-xs text-admin-muted">({p.status})</span>
                          </span>
                        ))}
                        {row.positions.length > 3 ? (
                          <span className="text-xs text-admin-muted">
                            +{row.positions.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <SeverityBadge severity={statusSeverity(row.status)}>{row.status}</SeverityBadge>
                  </Td>
                  <Td mono>
                    {row.questionCount}
                    {row.kind === 'interview' && row.usageCount != null
                      ? ` · used ${row.usageCount}`
                      : null}
                    {row.kind === 'assessment' && row.responseCount != null
                      ? ` · ${row.responseCount} resp`
                      : null}
                  </Td>
                  <Td>{row.createdBy || '—'}</Td>
                  <Td mono>{formatWhen(row.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTableEl>
        </DataTable>
      )}
    </div>
  );
}
