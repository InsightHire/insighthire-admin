'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BlogPostForm, type BlogPostFormValues } from '@/components/blog/blog-post-form';

const EMPTY: BlogPostFormValues = {
  title: '',
  slug: '',
  excerpt: '',
  contentJson: null,
  contentHtml: '',
  coverImageUrl: null,
  tags: [],
  seoTitle: '',
  seoDescription: '',
};

export default function NewBlogPostPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-admin-secondary hover:text-admin-ink">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-admin-ink">New post</h1>

      <div className="mt-6">
        <BlogPostForm initial={EMPTY} />
      </div>
    </div>
  );
}
