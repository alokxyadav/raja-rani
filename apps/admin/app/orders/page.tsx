'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Order {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  totalAmount: string;
  currency: string;
  createdAt: string;
  user: { name: string; email: string | null };
  items: { course: { title: string } }[];
  payments: { provider: string; providerPaymentId: string | null; status: string; amount: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-success/10 text-success',
  PENDING: 'bg-secondary/10 text-secondary',
  FAILED: 'bg-error/10 text-error',
  REFUNDED: 'bg-textMuted/10 text-textMuted',
};

export default function OrdersPage() {
  const { data, error, isLoading, mutate } = useSWR<Order[]>('/api/v1/admin/orders', (p: string) => apiFetch(p));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Orders & Payments</h1>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load orders.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Course(s)</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Provider / Payment ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <OrderRow key={order.id} order={order} onChanged={mutate} />
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-textMuted">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function OrderRow({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const payment = order.payments[order.payments.length - 1];

  async function handleRefund() {
    if (!confirm(`Refund ${order.user.name}'s payment of ₹${order.totalAmount}? This calls the real Razorpay refund API and revokes their course access.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      // Server-side (payments.service.ts) refuses this unless there's an
      // actual successful payment to refund, and it's a real Razorpay API
      // call, not a local status flip.
      await apiFetch(`/api/v1/payments/admin/orders/${order.id}/refund`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Refund failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <p className="font-medium">{order.user.name}</p>
        <p className="text-xs text-textMuted">{order.user.email}</p>
      </td>
      <td className="px-4 py-3">{order.items.map((i) => i.course.title).join(', ')}</td>
      <td className="px-4 py-3 font-semibold">₹{order.totalAmount}</td>
      <td className="px-4 py-3 text-xs">
        {payment ? `${payment.provider} · ${payment.providerPaymentId ?? '—'}` : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
          {order.status}
        </span>
      </td>
      <td className="px-4 py-3 text-textMuted text-xs">{new Date(order.createdAt).toLocaleString()}</td>
      <td className="px-4 py-3 text-right">
        {order.status === 'PAID' && (
          <button onClick={handleRefund} disabled={busy} className="text-error text-sm font-semibold disabled:opacity-50">
            {busy ? 'Refunding…' : 'Refund'}
          </button>
        )}
        {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
      </td>
    </tr>
  );
}
