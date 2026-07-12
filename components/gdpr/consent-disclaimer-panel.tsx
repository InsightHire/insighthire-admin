'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  FileText,
  Plus,
  Save,
  Upload,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Clock,
  Archive,
} from 'lucide-react';

type ConsentItem = {
  purpose: string;
  label: string;
  description: string;
  required: boolean;
  sortOrder: number;
};

type DraftForm = {
  title: string;
  introText: string;
  rightsTitle: string;
  rightsBullets: string[];
  privacyEmail: string;
  privacyPolicyPath: string;
  items: ConsentItem[];
  notes: string;
};

function emptyForm(): DraftForm {
  return {
    title: 'Before You Begin',
    introText: '',
    rightsTitle: 'Your Rights',
    rightsBullets: [''],
    privacyEmail: 'privacy@insighthire.com',
    privacyPolicyPath: '/privacy',
    items: [],
    notes: '',
  };
}

function formFromVersion(v: any): DraftForm {
  return {
    title: v.title ?? 'Before You Begin',
    introText: v.introText ?? '',
    rightsTitle: v.rightsTitle ?? 'Your Rights',
    rightsBullets: Array.isArray(v.rightsBullets) && v.rightsBullets.length ? [...v.rightsBullets] : [''],
    privacyEmail: v.privacyEmail ?? 'privacy@insighthire.com',
    privacyPolicyPath: v.privacyPolicyPath ?? '/privacy',
    items: Array.isArray(v.items)
      ? [...v.items]
          .sort((a: ConsentItem, b: ConsentItem) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((it: ConsentItem, idx: number) => ({
            purpose: it.purpose,
            label: it.label,
            description: it.description,
            required: !!it.required,
            sortOrder: idx,
          }))
      : [],
    notes: v.notes ?? '',
  };
}

export function ConsentDisclaimerPanel() {
  const listQuery = trpc.gdpr.listConsentDisclaimerVersions.useQuery(undefined, { retry: false });
  const createDraft = trpc.gdpr.createConsentDisclaimerDraft.useMutation({
    onSuccess: () => listQuery.refetch(),
  });
  const updateDraft = trpc.gdpr.updateConsentDisclaimerDraft.useMutation({
    onSuccess: () => listQuery.refetch(),
  });
  const publishDraft = trpc.gdpr.publishConsentDisclaimer.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setShowPreview(false);
    },
  });
  const discardDraft = trpc.gdpr.discardConsentDisclaimerDraft.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setForm(emptyForm());
      setSelectedDraftId(null);
    },
  });

  const versions = listQuery.data ?? [];
  const published = useMemo(
    () => versions.find((v: any) => v.status === 'PUBLISHED') ?? null,
    [versions]
  );
  const draft = useMemo(() => versions.find((v: any) => v.status === 'DRAFT') ?? null, [versions]);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(emptyForm());
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (draft) {
      setSelectedDraftId(draft.id);
      setForm(formFromVersion(draft));
    } else if (published && !selectedDraftId) {
      // show published as read-only baseline until a draft exists
      setForm(formFromVersion(published));
    }
  }, [draft?.id, published?.id]);

  const editingDraft = !!draft && selectedDraftId === draft.id;

  const bumpSort = (items: ConsentItem[]) =>
    items.map((it, idx) => ({ ...it, sortOrder: idx }));

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = [...form.items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setForm({ ...form, items: bumpSort(next) });
  };

  const handleCreateDraft = async () => {
    setError(null);
    try {
      await createDraft.mutateAsync({
        fromVersionId: published?.id,
        notes: 'Draft from published disclaimer',
      });
    } catch (e: any) {
      setError(e?.message || 'Could not create draft');
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setError(null);
    try {
      await updateDraft.mutateAsync({
        id: draft.id,
        data: {
          title: form.title.trim(),
          introText: form.introText.trim(),
          rightsTitle: form.rightsTitle.trim(),
          rightsBullets: form.rightsBullets.map((b) => b.trim()).filter(Boolean),
          privacyEmail: form.privacyEmail.trim(),
          privacyPolicyPath: form.privacyPolicyPath.trim(),
          items: bumpSort(form.items).map((it) => ({
            ...it,
            purpose: it.purpose.trim(),
            label: it.label.trim(),
            description: it.description.trim(),
          })),
          notes: form.notes.trim() || null,
        },
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'Could not save draft');
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (!window.confirm(`Publish ${draft.versionLabel}? This becomes the live candidate disclaimer and archives the previous published version.`)) {
      return;
    }
    setError(null);
    try {
      await handleSave();
      await publishDraft.mutateAsync({ id: draft.id });
    } catch (e: any) {
      setError(e?.message || 'Could not publish');
    }
  };

  const handleDiscard = async () => {
    if (!draft) return;
    if (!window.confirm(`Discard draft ${draft.versionLabel}? This cannot be undone.`)) return;
    setError(null);
    try {
      await discardDraft.mutateAsync({ id: draft.id });
    } catch (e: any) {
      setError(e?.message || 'Could not discard draft');
    }
  };

  if (listQuery.isLoading) {
    return <p className="text-sm text-gray-500 py-8">Loading consent disclaimer versions…</p>;
  }

  if (listQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load disclaimer versions. Confirm platform-admin access and that the API migration has run.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Candidate consent disclaimer
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Platform-owned &quot;Before You Begin&quot; gate shown on journeys and assessments.
              Publish creates an immutable version stored on each consent grant.
            </p>
          </div>
          <div className="text-sm">
            {published ? (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <div className="flex items-center gap-1.5 font-medium text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  Published {published.versionLabel}
                </div>
                <p className="text-xs text-green-700 mt-0.5">
                  {published.publishedAt
                    ? new Date(published.publishedAt).toLocaleString()
                    : 'Live'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                No published version — candidates use hardcoded fallback until you publish.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!draft && (
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={createDraft.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New draft from published
            </button>
          )}
          {draft && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateDraft.isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savedFlash ? 'Saved' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishDraft.isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Publish {draft.versionLabel}
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={discardDraft.isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Discard draft
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {editingDraft ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Editing draft <span className="font-mono text-blue-700">{draft.versionLabel}</span>
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" /> DRAFT
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Title</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Internal notes</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Changelog for this version"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Intro text</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
              value={form.introText}
              onChange={(e) => setForm({ ...form, introText: e.target.value })}
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Consent items</h4>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:underline"
                onClick={() =>
                  setForm({
                    ...form,
                    items: bumpSort([
                      ...form.items,
                      {
                        purpose: `CUSTOM_${form.items.length + 1}`,
                        label: 'New item',
                        description: '',
                        required: true,
                        sortOrder: form.items.length,
                      },
                    ]),
                  })
                }
              >
                + Add item
              </button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={`${item.purpose}-${index}`} className="rounded-xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => moveItem(index, -1)} className="p-1 text-gray-400 hover:text-gray-700" title="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => moveItem(index, 1)} className="p-1 text-gray-400 hover:text-gray-700" title="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="font-medium text-gray-600">Purpose key</span>
                        <input
                          className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
                          value={item.purpose}
                          onChange={(e) => {
                            const items = [...form.items];
                            items[index] = { ...item, purpose: e.target.value };
                            setForm({ ...form, items });
                          }}
                        />
                      </label>
                      <label className="text-xs">
                        <span className="font-medium text-gray-600">Label</span>
                        <input
                          className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={item.label}
                          onChange={(e) => {
                            const items = [...form.items];
                            items[index] = { ...item, label: e.target.value };
                            setForm({ ...form, items });
                          }}
                        />
                      </label>
                      <label className="text-xs md:col-span-2">
                        <span className="font-medium text-gray-600">Description</span>
                        <textarea
                          className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm min-h-[64px]"
                          value={item.description}
                          onChange={(e) => {
                            const items = [...form.items];
                            items[index] = { ...item, description: e.target.value };
                            setForm({ ...form, items });
                          }}
                        />
                      </label>
                      <div className="flex items-center justify-between md:col-span-2">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) => {
                              const items = [...form.items];
                              items[index] = { ...item, required: e.target.checked };
                              setForm({ ...form, items });
                            }}
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() =>
                            setForm({
                              ...form,
                              items: bumpSort(form.items.filter((_, i) => i !== index)),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Rights section title</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.rightsTitle}
                onChange={(e) => setForm({ ...form, rightsTitle: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Privacy email</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.privacyEmail}
                onChange={(e) => setForm({ ...form, privacyEmail: e.target.value })}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-gray-700">Privacy policy path</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.privacyPolicyPath}
                onChange={(e) => setForm({ ...form, privacyPolicyPath: e.target.value })}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Rights bullets</h4>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:underline"
                onClick={() => setForm({ ...form, rightsBullets: [...form.rightsBullets, ''] })}
              >
                + Add bullet
              </button>
            </div>
            <div className="space-y-2">
              {form.rightsBullets.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={b}
                    onChange={(e) => {
                      const rightsBullets = [...form.rightsBullets];
                      rightsBullets[i] = e.target.value;
                      setForm({ ...form, rightsBullets });
                    }}
                  />
                  <button
                    type="button"
                    className="text-xs text-red-600 px-2"
                    onClick={() =>
                      setForm({
                        ...form,
                        rightsBullets: form.rightsBullets.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-sm text-gray-500">
          No draft open. Create a draft from the published version to edit language or items.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Version history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-2 font-mono text-xs text-gray-900">{v.versionLabel}</td>
                  <td className="px-4 py-2">
                    <StatusPill status={v.status} />
                  </td>
                  <td className="px-4 py-2 text-gray-800">{v.title}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate" title={v.notes || ''}>
                    {v.notes || '—'}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No versions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="bg-[#0a5fc4] px-8 py-6 text-white">
              <h1 className="text-2xl font-bold">{form.title}</h1>
              <p className="text-white/85 mt-1 text-sm">
                Example Org uses InsightHire to manage this assessment.
              </p>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-sm text-gray-600">{form.introText}</p>
              {form.items.map((item) => (
                <div key={item.purpose} className="rounded-xl border-2 border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{item.label}</span>
                    {item.required && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
              ))}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{form.rightsTitle}</h3>
                <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                  {form.rightsBullets.filter(Boolean).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Contact {form.privacyEmail} · Policy {form.privacyPolicyPath}
                </p>
              </div>
            </div>
            <div className="px-8 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'PUBLISHED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle className="h-3 w-3" /> Published
      </span>
    );
  }
  if (status === 'DRAFT') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="h-3 w-3" /> Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      <Archive className="h-3 w-3" /> Archived
    </span>
  );
}
