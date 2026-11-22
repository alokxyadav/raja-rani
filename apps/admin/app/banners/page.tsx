'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  ctaLabel: string | null;
  isActive: boolean;
  priority: number;
}

export default function BannersPage() {
  const { data, error, isLoading, mutate } = useSWR<Banner[]>('/api/v1/banners', (p: string) => apiFetch(p));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Banners</h1>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + New Banner
        </button>
      </div>

      {showCreate && <CreateBannerForm onDone={() => { setShowCreate(false); mutate(); }} />}

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load banners.</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((banner) => (
            <div key={banner.id} className="bg-surface border border-border rounded-card overflow-hidden">
              <img src={banner.imageUrl} alt={banner.title} className="w-full h-32 object-cover bg-primaryLight/10" />
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{banner.title}</p>
                  <p className="text-xs text-textMuted">Priority {banner.priority}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${banner.isActive ? 'bg-success/10 text-success' : 'bg-textMuted/10 text-textMuted'}`}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="text-textMuted col-span-2">No banners yet.</p>}
        </div>
      )}
    </AdminShell>
  );
}

function CreateBannerForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/banners', {
        method: 'POST',
        body: JSON.stringify({ title, imageUrl, ctaLabel: ctaLabel || undefined }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create banner.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 mb-6 grid grid-cols-3 gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Image URL</label>
        <input required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">CTA label (optional)</label>
        <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      {error && <p className="text-error text-sm col-span-3">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 h-fit">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
