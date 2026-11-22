'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface LiveClass {
  id: string;
  title: string;
  instructorName: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
}

export default function LiveClassesPage() {
  const { data, error, isLoading, mutate } = useSWR<LiveClass[]>('/api/v1/live-classes', (p: string) => apiFetch(p));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Live Classes</h1>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Schedule Class
        </button>
      </div>

      {showCreate && <ScheduleForm onDone={() => { setShowCreate(false); mutate(); }} />}

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load live classes.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((lc) => <LiveClassRow key={lc.id} liveClass={lc} onChanged={mutate} />)}
              {data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-textMuted">No live classes scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function LiveClassRow({ liveClass, onChanged }: { liveClass: LiveClass; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function transition(action: 'start' | 'end' | 'cancel') {
    setBusy(true);
    setActionError(null);
    try {
      // Server enforces the state machine (courses.service.ts-style
      // validation, in live-classes.service.ts) — an invalid transition
      // (e.g. ending an already-ended class) comes back as a real 400 with
      // a clear message, surfaced below rather than silently ignored.
      await apiFetch(`/api/v1/live-classes/${liveClass.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">{liveClass.title}</td>
      <td className="px-4 py-3">{liveClass.instructorName}</td>
      <td className="px-4 py-3">{new Date(liveClass.scheduledAt).toLocaleString()}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          liveClass.status === 'LIVE' ? 'bg-error/10 text-error'
          : liveClass.status === 'SCHEDULED' ? 'bg-primary/10 text-primary'
          : 'bg-textMuted/10 text-textMuted'
        }`}>
          {liveClass.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right space-x-3">
        {liveClass.status === 'SCHEDULED' && (
          <>
            <button onClick={() => transition('start')} disabled={busy} className="text-primary text-sm font-semibold disabled:opacity-50">Start</button>
            <button onClick={() => transition('cancel')} disabled={busy} className="text-error text-sm font-semibold disabled:opacity-50">Cancel</button>
          </>
        )}
        {liveClass.status === 'LIVE' && (
          <button onClick={() => transition('end')} disabled={busy} className="text-primary text-sm font-semibold disabled:opacity-50">End</button>
        )}
        {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
      </td>
    </tr>
  );
}

function ScheduleForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title,
          instructorName,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes),
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not schedule class.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 mb-6 grid grid-cols-4 gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Instructor</label>
        <input required value={instructorName} onChange={(e) => setInstructorName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date & time</label>
        <input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Duration (min)</label>
        <input required type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      {error && <p className="text-error text-sm col-span-4">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 h-fit">
        {submitting ? 'Scheduling…' : 'Schedule'}
      </button>
    </form>
  );
}
