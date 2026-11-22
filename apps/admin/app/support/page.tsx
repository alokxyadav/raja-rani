'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Ticket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminResponse: string | null;
  createdAt: string;
  user: { name: string; email: string | null };
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-secondary/10 text-secondary',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  RESOLVED: 'bg-success/10 text-success',
  CLOSED: 'bg-textMuted/10 text-textMuted',
};

export default function SupportPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, error, isLoading, mutate } = useSWR<Ticket[]>(
    `/api/v1/support/tickets${statusFilter ? `?status=${statusFilter}` : ''}`,
    (p: string) => apiFetch(p),
  );

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load tickets.</p>}

      {data && (
        <div className="space-y-3">
          {data.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onChanged={mutate} />
          ))}
          {data.length === 0 && <p className="text-textMuted">No tickets match this filter.</p>}
        </div>
      )}
    </AdminShell>
  );
}

function TicketCard({ ticket, onChanged }: { ticket: Ticket; onChanged: () => void }) {
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('IN_PROGRESS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/support/tickets/${ticket.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response, status }),
      });
      setResponding(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit response.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{ticket.subject}</p>
          <p className="text-xs text-textMuted">
            {ticket.user.name} ({ticket.user.email}) · {ticket.category} · {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}>
          {ticket.status}
        </span>
      </div>
      <p className="text-sm mt-2">{ticket.message}</p>

      {ticket.adminResponse && (
        <div className="mt-3 bg-background border border-border rounded-lg p-3">
          <p className="text-xs font-semibold mb-1">Support response:</p>
          <p className="text-sm">{ticket.adminResponse}</p>
        </div>
      )}

      {!responding ? (
        <button onClick={() => setResponding(true)} className="text-primary text-sm font-semibold mt-3">
          {ticket.adminResponse ? 'Update response' : 'Respond'}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            placeholder="Write a response…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border border-border rounded-lg px-2 py-1 text-sm">
              <option value="IN_PROGRESS">Mark in progress</option>
              <option value="RESOLVED">Mark resolved</option>
              <option value="CLOSED">Close ticket</option>
            </select>
            <button onClick={handleSubmit} disabled={submitting || !response} className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60">
              {submitting ? 'Sending…' : 'Send'}
            </button>
            <button onClick={() => setResponding(false)} className="text-textMuted text-sm">Cancel</button>
          </div>
          {error && <p className="text-error text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
