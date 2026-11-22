'use client';

import { useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'STUDENT'>('STUDENT');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Send this to every ${audience === 'ALL' ? 'active user' : 'student'}? This can't be undone.`)) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<{ recipientCount: number }>('/api/v1/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title, body, audience }),
      });
      setResult(`Sent to ${res.recipientCount} users.`);
      setTitle('');
      setBody('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Broadcast failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-2">Notifications</h1>
      <p className="text-sm text-textMuted mb-6">
        Sends an in-app notification to every matching user, plus a push if they have a
        registered device. Use sparingly — notifying on everything trains people to ignore it.
      </p>

      <form onSubmit={handleSend} className="bg-surface border border-border rounded-card p-5 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as 'ALL' | 'STUDENT')} className="w-full border border-border rounded-lg px-3 py-2">
            <option value="STUDENT">Students only</option>
            <option value="ALL">All active users</option>
          </select>
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        {result && <p className="text-success text-sm">{result}</p>}
        <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
          {submitting ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
    </AdminShell>
  );
}
