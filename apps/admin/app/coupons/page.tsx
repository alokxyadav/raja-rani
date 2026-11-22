'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Coupon {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: string | null;
  redemptionCount: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
}

export default function CouponsPage() {
  const { data, error, isLoading, mutate } = useSWR<Coupon[]>('/api/v1/coupons', (p: string) => apiFetch(p));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + New Coupon
        </button>
      </div>

      {showCreate && <CreateCouponForm onDone={() => { setShowCreate(false); mutate(); }} />}

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load coupons.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Redemptions</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <CouponRow key={c.id} coupon={c} onChanged={mutate} />
              ))}
              {data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-textMuted">No coupons yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function CouponRow({ coupon, onChanged }: { coupon: Coupon; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const expired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();

  async function handleDeactivate() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/coupons/${coupon.id}/deactivate`, { method: 'POST' });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-mono font-semibold">{coupon.code}</td>
      <td className="px-4 py-3">{coupon.percentOff ? `${coupon.percentOff}% off` : `₹${coupon.amountOff} off`}</td>
      <td className="px-4 py-3">{coupon.redemptionCount}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}</td>
      <td className="px-4 py-3">
        {coupon.expiresAt ? (
          <span className={expired ? 'text-error' : ''}>{new Date(coupon.expiresAt).toLocaleDateString()}</span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {!expired && (
          <button onClick={handleDeactivate} disabled={busy} className="text-error text-sm font-semibold disabled:opacity-50">
            {busy ? 'Working…' : 'Deactivate'}
          </button>
        )}
      </td>
    </tr>
  );
}

function CreateCouponForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [percentOff, setPercentOff] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code,
          percentOff: Number(percentOff),
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create coupon.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 mb-6 grid grid-cols-4 gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Code</label>
        <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full border border-border rounded-lg px-3 py-2 font-mono" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Percent off</label>
        <input required type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max redemptions (optional)</label>
        <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      {error && <p className="text-error text-sm col-span-4">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 h-fit">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
