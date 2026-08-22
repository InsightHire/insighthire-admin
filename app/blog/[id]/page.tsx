'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BlogPostForm } from '@/components/blog/blog-post-form';

export default function EditBlogPostPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: post, isLoading } = trpc.blogAdmin.getPost.useQuery({ id });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-secondary hover:text-admin-ink">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-admin-ink">Edit post</h1>

      <div className="mt-6">
        {isLoading ? (
          <div className="rounded-lg border border-admin-border bg-white p-8 text-center text-sm text-admin-secondary">
            Loading…
          </div>
        ) : !post ? (
          <div className="rounded-lg border border-admin-border bg-white p-8 text-center text-sm text-admin-secondary">
            Post not found.
          </div>
        ) : (
          <BlogPostForm
            initial={{
              id: post.id,
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt,
              contentJson: post.contentJson as any,
              contentHtml: post.contentHtml,
              coverImageUrl: post.coverImageUrl,
              tags: post.tags,
              seoTitle: post.seoTitle ?? '',
              seoDescription: post.seoDescription ?? '',
              status: post.status,
            }}
          />
        )}
      </div>
    </div>
  );
}
