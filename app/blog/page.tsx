'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function BlogListPage() {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL');
  const { data: posts, isLoading, refetch } = trpc.blogAdmin.listPosts.useQuery({ status: statusFilter });
  const deletePost = trpc.blogAdmin.deletePost.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-admin-ink">Blog</h1>
          <p className="mt-1 text-sm text-admin-secondary">Create and publish posts for insighthire.com/blog.</p>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center gap-2 rounded-lg bg-admin-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {(['ALL', 'DRAFT', 'PUBLISHED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              statusFilter === s ? 'bg-admin-ink text-white' : 'bg-white text-admin-secondary ring-1 ring-admin-border'
            }`}
          >
            {s === 'ALL' ? 'All' : s === 'DRAFT' ? 'Drafts' : 'Published'}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-admin-border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-admin-secondary">Loading…</div>
        ) : !posts || posts.length === 0 ? (
          <div className="p-8 text-center text-sm text-admin-secondary">No posts yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-admin-secondary">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post: any) => (
                <tr key={post.id}>
                  <td className="px-4 py-3 font-medium text-admin-ink">
                    <Link href={`/blog/${post.id}`} className="hover:text-admin-accent">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {post.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-admin-secondary">{post.tags.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-admin-secondary">{post.authorName}</td>
                  <td className="px-4 py-3 text-admin-secondary">{new Date(post.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${post.title}"? This cannot be undone.`)) {
                          deletePost.mutate({ id: post.id });
                        }
                      }}
                      className="text-xs font-medium text-admin-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
