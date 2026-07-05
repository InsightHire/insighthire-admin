'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';

function DevopsSkillsContent() {
  useAdminAuth();
  const utils = trpc.useUtils();
  const skillsQuery = trpc.platformAdmin.listDevopsSkills.useQuery();
  const updateMutation = trpc.platformAdmin.updateDevopsSkill.useMutation({
    onSuccess: () => utils.platformAdmin.listDevopsSkills.invalidate(),
  });

  const skills = skillsQuery.data?.skills ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [saved, setSaved] = useState(false);

  const selected = useMemo(
    () => skills.find((s) => s.id === selectedId) ?? null,
    [skills, selectedId],
  );

  const selectSkill = (id: string, body: string) => {
    setSelectedId(id);
    setDraftBody(body);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedId || !draftBody.trim()) return;
    await updateMutation.mutateAsync({ id: selectedId, body: draftBody });
    setSaved(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/devops"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> DevOps
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-indigo-600" />
            Agent skills
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Reusable playbooks injected into Cursor agent prompts on spawn. Matched by incident rule,
            repo, and service — plus always-on baseline guardrails.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {skillsQuery.isLoading && (
            <p className="text-sm text-gray-500">Loading skills…</p>
          )}
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => selectSkill(skill.id, skill.body)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                selectedId === skill.id
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{skill.name}</span>
                {skill.alwaysApply && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    Always
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 font-mono">{skill.slug}</p>
              {skill.description && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2">{skill.description}</p>
              )}
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5">
          {!selected ? (
            <p className="text-sm text-gray-500">Select a skill to view or edit its playbook.</p>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
              </div>
              <textarea
                value={draftBody}
                onChange={(e) => {
                  setDraftBody(e.target.value);
                  setSaved(false);
                }}
                rows={22}
                className="w-full font-mono text-sm border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                spellCheck={false}
              />
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Markdown · changes apply on next agent spawn
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isLoading || !draftBody.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isLoading ? 'Saving…' : saved ? 'Saved' : 'Save skill'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DevopsSkillsPage() {
  return (
    <AuthenticatedLayout>
      <DevopsSkillsContent />
    </AuthenticatedLayout>
  );
}
