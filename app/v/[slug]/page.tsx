import { notFound } from 'next/navigation';
import { cdnVideoStreamUrl } from '@/lib/cdn-public-url';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

type PublicVideo = {
  slug: string;
  title: string | null;
  description: string | null;
  contentType: string;
  fileSizeBytes: number | null;
};

async function fetchPublicVideo(slug: string): Promise<PublicVideo | null> {
  const res = await fetch(`${API_BASE}/cdn/v/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export default async function CdnVideoPlayerPage({ params }: { params: { slug: string } }) {
  const video = await fetchPublicVideo(params.slug);
  if (!video) notFound();

  const title = video.title || 'InsightHire video';
  const streamUrl = cdnVideoStreamUrl(video.slug);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-10">
        <img
          src="/brand/insighthire-logo-dark.png"
          alt="InsightHire"
          className="mb-8 h-8 w-auto sm:h-9"
        />
        <h1 className="mb-3 text-center text-lg font-semibold text-white sm:text-xl">{title}</h1>
        {video.description ? (
          <p className="mb-6 max-w-2xl text-center text-sm leading-relaxed text-slate-300 sm:text-base">
            {video.description}
          </p>
        ) : null}
        <video
          className="w-full max-w-4xl rounded-xl bg-black shadow-2xl shadow-black/40"
          controls
          playsInline
          preload="metadata"
          src={streamUrl}
        />
      </main>
    </div>
  );
}
