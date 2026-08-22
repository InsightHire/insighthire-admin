'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import { trpc } from '@/lib/trpc';
import { BlogRichTextEditor } from './blog-rich-text-editor';

export type BlogPostFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  contentJson: JSONContent | null;
  contentHtml: string;
  coverImageUrl: string | null;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  status?: 'DRAFT' | 'PUBLISHED';
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function BlogPostForm({ initial }: { initial: BlogPostFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.blogAdmin.getUploadUrl.useMutation();
  const createPost = trpc.blogAdmin.createPost.useMutation();
  const updatePost = trpc.blogAdmin.updatePost.useMutation();
  const setStatus = trpc.blogAdmin.setStatus.useMutation();

  const isEditing = Boolean(values.id);
  const saving = createPost.isLoading || updatePost.isLoading || setStatus.isLoading;

  function update<K extends keyof BlogPostFormValues>(key: K, value: BlogPostFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addTag() {
    const name = tagInput.trim();
    if (!name || values.tags.includes(name)) {
      setTagInput('');
      return;
    }
    update('tags', [...values.tags, name]);
    setTagInput('');
  }

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { presignedUrl, publicUrl } = await getUploadUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      update('coverImageUrl', publicUrl);
    } catch {
      setError('Cover image upload failed. Please try again.');
    }
  }

  async function save(publish: boolean): Promise<string | null> {
    setError(null);
    if (!values.title.trim()) {
      setError('Title is required.');
      return null;
    }
    if (!values.excerpt.trim()) {
      setError('Excerpt is required.');
      return null;
    }
    if (!values.contentHtml.trim()) {
      setError('Post body cannot be empty.');
      return null;
    }

    const payload = {
      title: values.title,
      slug: values.slug || slugify(values.title),
      excerpt: values.excerpt,
      contentHtml: values.contentHtml,
      contentJson: values.contentJson,
      coverImageUrl: values.coverImageUrl,
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
      tags: values.tags,
    };

    try {
      let id = values.id;
      if (id) {
        await updatePost.mutateAsync({ id, ...payload });
      } else {
        const created = await createPost.mutateAsync(payload);
        id = created.id;
        update('id', id);
      }
      if (publish && id) {
        await setStatus.mutateAsync({ id, status: 'PUBLISHED' });
      }
      return id ?? null;
    } catch (err: any) {
      setError(err?.message || 'Failed to save post.');
      return null;
    }
  }

  async function handleSaveDraft() {
    const id = await save(false);
    if (id) router.push('/blog');
  }

  async function handlePublish() {
    const id = await save(true);
    if (id) router.push('/blog');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-lg border border-admin-border bg-white p-4">
          <label className="block text-sm font-medium text-admin-secondary">Title</label>
          <input
            type="text"
            value={values.title}
            onChange={(e) => {
              update('title', e.target.value);
              if (!slugTouched) update('slug', slugify(e.target.value));
            }}
            placeholder="Why resume screening doesn't predict who can do the job"
            className="mt-1 w-full rounded-md border border-admin-border px-3 py-2 text-lg font-semibold focus:border-admin-ink focus:outline-none"
          />
          <label className="mt-4 block text-sm font-medium text-admin-secondary">Slug</label>
          <div className="mt-1 flex items-center gap-1 text-sm text-admin-muted">
            <span>/blog/</span>
            <input
              type="text"
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update('slug', slugify(e.target.value));
              }}
              className="flex-1 rounded-md border border-admin-border px-3 py-1.5 font-mono text-sm focus:border-admin-ink focus:outline-none"
            />
          </div>
          <label className="mt-4 block text-sm font-medium text-admin-secondary">Excerpt</label>
          <textarea
            value={values.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="One or two sentences shown on the index page and in search results."
            className="mt-1 w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-ink focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-admin-secondary">Body</label>
          <BlogRichTextEditor
            content={values.contentJson}
            onChange={(json, html) => {
              update('contentJson', json);
              update('contentHtml', html);
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-admin-border bg-white p-4">
          <h3 className="text-sm font-semibold text-admin-ink">Cover image</h3>
          {values.coverImageUrl ? (
            <div className="relative mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.coverImageUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
              <button
                type="button"
                onClick={() => update('coverImageUrl', null)}
                className="mt-2 text-xs font-medium text-admin-danger hover:opacity-80"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="mt-3 flex aspect-video w-full items-center justify-center rounded-md border-2 border-dashed border-admin-border text-sm text-admin-muted hover:border-slate-400"
            >
              {getUploadUrl.isLoading ? 'Uploading…' : 'Click to upload'}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
        </div>

        <div className="rounded-lg border border-admin-border bg-white p-4">
          <h3 className="text-sm font-semibold text-admin-ink">Tags</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-admin-secondary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => update('tags', values.tags.filter((t) => t !== tag))}
                  className="text-admin-muted hover:text-admin-secondary"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add a tag, press Enter"
            className="mt-3 w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-ink focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-admin-border bg-white p-4">
          <h3 className="text-sm font-semibold text-admin-ink">SEO</h3>
          <label className="mt-3 block text-xs font-medium text-admin-muted">
            Meta title <span className="font-normal">(optional — defaults to the post title)</span>
          </label>
          <input
            type="text"
            value={values.seoTitle}
            onChange={(e) => update('seoTitle', e.target.value)}
            className="mt-1 w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-ink focus:outline-none"
          />
          <label className="mt-3 block text-xs font-medium text-admin-muted">
            Meta description <span className="font-normal">(optional — defaults to the excerpt)</span>
          </label>
          <textarea
            value={values.seoDescription}
            onChange={(e) => update('seoDescription', e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-ink focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {values.status === 'PUBLISHED' ? 'Save & keep published' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="rounded-lg border border-admin-border px-4 py-2.5 text-sm font-semibold text-admin-secondary hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          {isEditing && values.status === 'PUBLISHED' && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!values.id) return;
                await setStatus.mutateAsync({ id: values.id, status: 'DRAFT' });
                update('status', 'DRAFT');
              }}
              className="text-xs font-medium text-admin-muted hover:text-admin-secondary"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
