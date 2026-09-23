'use client';

import { useRef, useState } from 'react';
import { Copy, ExternalLink, Trash2, Upload, Ban } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  if (status === 'READY') return 'bg-green-100 text-green-800';
  if (status === 'REVOKED') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export default function CdnVideosPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: videos, isLoading, refetch } = trpc.platformAdmin.listCdnVideos.useQuery();
  const createUpload = trpc.platformAdmin.createCdnVideoUpload.useMutation();
  const confirmUpload = trpc.platformAdmin.confirmCdnVideoUpload.useMutation();
  const revokeVideo = trpc.platformAdmin.revokeCdnVideo.useMutation({ onSuccess: () => refetch() });
  const deleteVideo = trpc.platformAdmin.deleteCdnVideo.useMutation({ onSuccess: () => refetch() });

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage('Link copied');
    setTimeout(() => setMessage(null), 2000);
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!selectedFile) {
      setMessage('Choose a video file first');
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const intent = await createUpload.mutateAsync({
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
        title: title.trim() || selectedFile.name.replace(/\.[^.]+$/, ''),
        description: description.trim() || null,
      });

      const putRes = await fetch(intent.presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': selectedFile.type },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      await confirmUpload.mutateAsync({ id: intent.id });
      resetForm();
      await refetch();
      setMessage('Video uploaded — public link ready');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-admin-ink">Video CDN</h1>
        <p className="mt-1 text-sm text-admin-secondary">
          Upload videos and share hashed public links at{' '}
          <code className="rounded bg-slate-100 px-1">cdn.insighthire.com/v/…</code> — no login required to view.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-admin-border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-admin-ink">Upload video</h2>
        <p className="mt-1 text-xs text-admin-secondary">MP4, WebM, or MOV up to 1 GB.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-admin-secondary">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product demo — candidate journey"
              className="w-full rounded-lg border border-admin-border px-3 py-2"
              disabled={uploading}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-admin-secondary">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context shown on the public player page"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-admin-border px-3 py-2"
              disabled={uploading}
            />
            <span className="mt-1 block text-xs text-admin-secondary">{description.length}/2000</span>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-admin-border bg-white px-4 py-2 text-sm font-medium text-admin-ink hover:bg-slate-50">
            Choose file
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov"
              className="hidden"
              disabled={uploading}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {selectedFile ? (
            <span className="text-sm text-admin-secondary">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </span>
          ) : (
            <span className="text-sm text-admin-secondary">No file selected</span>
          )}
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || !selectedFile}
            className="inline-flex items-center gap-2 rounded-lg bg-admin-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload video'}
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-admin-secondary">{message}</p> : null}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-admin-border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-admin-secondary">Loading…</div>
        ) : !videos || videos.length === 0 ? (
          <div className="p-8 text-center text-sm text-admin-secondary">No videos yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-admin-secondary">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Links</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {videos.map((video: any) => (
                <tr key={video.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-admin-ink">{video.title || video.originalFileName || 'Untitled'}</div>
                    {video.description ? (
                      <div className="mt-1 line-clamp-2 text-xs text-admin-secondary">{video.description}</div>
                    ) : null}
                    <div className="mt-0.5 font-mono text-xs text-admin-secondary">{video.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(video.status)}`}>
                      {video.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-admin-secondary">{formatBytes(video.fileSizeBytes)}</td>
                  <td className="px-4 py-3 text-admin-secondary">
                    {new Date(video.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(video.playerUrl)}
                        className="inline-flex items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs hover:bg-slate-50"
                        disabled={video.status !== 'READY'}
                      >
                        <Copy className="h-3 w-3" /> Player
                      </button>
                      <button
                        type="button"
                        onClick={() => copyLink(video.streamUrl)}
                        className="inline-flex items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs hover:bg-slate-50"
                        disabled={video.status !== 'READY'}
                      >
                        <Copy className="h-3 w-3" /> Direct
                      </button>
                      {video.status === 'READY' ? (
                        <a
                          href={video.playerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-admin-border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {video.status === 'READY' ? (
                        <button
                          type="button"
                          onClick={() => revokeVideo.mutate({ id: video.id })}
                          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
                        >
                          <Ban className="h-3 w-3" /> Revoke
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this video permanently?')) {
                            deleteVideo.mutate({ id: video.id });
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
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
