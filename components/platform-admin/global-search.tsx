'use client';

/**
 * Global Cmd-K search palette — one query across organizations, users,
 * candidates, positions, and tenant quotes. Mounted once in
 * AuthenticatedLayout so it works from every admin page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  UserIcon,
  UserCircleIcon,
  BriefcaseIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

type ResultItem = {
  key: string;
  group: string;
  icon: typeof BuildingOfficeIcon;
  label: string;
  sublabel: string;
  href: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setDebounced('');
      setHighlight(0);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = (trpc as any).platformAdmin.globalSearch.useQuery(
    { query: debounced },
    { enabled: open && debounced.trim().length >= 2, keepPreviousData: true },
  );

  const items: ResultItem[] = useMemo(() => {
    const d = search.data;
    if (!d) return [];
    const out: ResultItem[] = [];
    for (const o of d.organizations ?? []) {
      out.push({
        key: `org-${o.id}`, group: 'Organizations', icon: BuildingOfficeIcon,
        label: o.name || o.id, sublabel: [o.domain, o.subscriptionPlan].filter(Boolean).join(' · '),
        href: `/organizations/${o.id}`,
      });
    }
    for (const u of d.users ?? []) {
      out.push({
        key: `user-${u.id}`, group: 'Users', icon: UserIcon,
        label: u.name, sublabel: [u.email, u.organizationName, u.role].filter(Boolean).join(' · '),
        href: u.organizationId ? `/organizations/${u.organizationId}` : '/organizations',
      });
    }
    for (const c of d.candidates ?? []) {
      out.push({
        key: `cand-${c.id}`, group: 'Candidates', icon: UserCircleIcon,
        label: c.name, sublabel: [c.email, c.organizationName].filter(Boolean).join(' · '),
        href: `/candidate/${c.id}`,
      });
    }
    for (const p of d.positions ?? []) {
      out.push({
        key: `pos-${p.id}`, group: 'Positions', icon: BriefcaseIcon,
        label: p.title, sublabel: [p.organizationName, p.status].filter(Boolean).join(' · '),
        href: p.organizationId ? `/organizations/${p.organizationId}` : '/organizations',
      });
    }
    for (const q of d.quotes ?? []) {
      out.push({
        key: `quote-${q.id}`, group: 'Quotes', icon: DocumentTextIcon,
        label: `${q.companyName} — $${q.amount.toLocaleString()} ${String(q.currency).toUpperCase()}`,
        sublabel: [q.publicId, q.recipientEmail, q.status].filter(Boolean).join(' · '),
        href: `/sales/quotes/${q.id}`,
      });
    }
    return out;
  }, [search.data]);

  const go = useCallback((item: ResultItem) => {
    setOpen(false);
    router.push(item.href);
  }, [router]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && items[highlight]) {
      e.preventDefault();
      go(items[highlight]);
    }
  };

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/40 pt-[12vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={onInputKey}
            placeholder="Search orgs, users, candidates, positions, quotes…"
            className="w-full py-3.5 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {debounced.trim().length < 2 ? (
            <p className="px-4 py-6 text-sm text-gray-400">Type at least 2 characters to search.</p>
          ) : search.isLoading ? (
            <p className="px-4 py-6 text-sm text-gray-400">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No results for “{debounced}”.</p>
          ) : (
            items.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.key}>
                  {showGroup && (
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {item.group}
                    </p>
                  )}
                  <button
                    onClick={() => go(item)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                      i === highlight ? 'bg-blue-50' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-gray-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{item.label}</span>
                      {item.sublabel && (
                        <span className="block truncate text-xs text-gray-500">{item.sublabel}</span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
