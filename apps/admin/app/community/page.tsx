'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Post {
  id: string;
  body: string;
  isAnnouncement: boolean;
  createdAt: string;
  user: { name: string };
  _count: { comments: number };
}

export default function CommunityModerationPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: Post[] }>('/api/v1/community/feed', (p: string) => apiFetch(p));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Community Moderation</h1>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load the feed.</p>}

      {data && (
        <div className="space-y-3">
          {data.items.map((post) => (
            <PostRow key={post.id} post={post} onChanged={mutate} />
          ))}
          {data.items.length === 0 && <p className="text-textMuted">No posts yet.</p>}
        </div>
      )}
    </AdminShell>
  );
}

function PostRow({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!confirm('Remove this post? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      // Server-side moderation (community.service.ts, Phase 6) — this
      // endpoint requires ADMIN/INSTRUCTOR regardless of who posted it,
      // distinct from the student-facing "delete own post" endpoint.
      await apiFetch(`/api/v1/community/posts/${post.id}/moderate`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`bg-surface border border-border rounded-card p-4 ${post.isAnnouncement ? 'border-primary' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">
            {post.user.name}
            {post.isAnnouncement && <span className="ml-2 text-xs text-primary font-normal">Announcement</span>}
          </p>
          <p className="text-xs text-textMuted">{new Date(post.createdAt).toLocaleString()} · {post._count.comments} comments</p>
        </div>
        <button onClick={handleRemove} disabled={busy} className="text-error text-sm font-semibold disabled:opacity-50">
          {busy ? 'Removing…' : 'Remove'}
        </button>
      </div>
      <p className="mt-2 text-sm">{post.body}</p>
      {error && <p className="text-error text-xs mt-1">{error}</p>}
    </div>
  );
}
