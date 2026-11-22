'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const { data, error, isLoading, mutate } = useSWR<AdminUser[]>(
    `/api/v1/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    (path: string) => apiFetch(path),
  );

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Users</h1>

      <input
        placeholder="Search by name, email, or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-border rounded-lg px-3 py-2 mb-6"
      />

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load users.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <UserRow key={user.id} user={user} onChanged={mutate} />
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-textMuted">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function UserRow({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggleStatus() {
    setBusy(true);
    setActionError(null);
    const action = user.status === 'ACTIVE' ? 'suspend' : 'reactivate';
    try {
      // Every call here writes an AuditLog row server-side (admin.service.ts,
      // Phase 7) — actor, action, before/after status — no extra work needed
      // on this page for that to happen.
      await apiFetch(`/api/v1/admin/users/${user.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">{user.name}</td>
      <td className="px-4 py-3 text-textMuted">{user.email ?? user.phone ?? '—'}</td>
      <td className="px-4 py-3">{user.role}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            user.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {user.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {user.role !== 'ADMIN' && (
          <button
            onClick={toggleStatus}
            disabled={busy}
            className={`text-sm font-semibold disabled:opacity-50 ${
              user.status === 'ACTIVE' ? 'text-error' : 'text-primary'
            }`}
          >
            {busy ? 'Working…' : user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
          </button>
        )}
        {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
      </td>
    </tr>
  );
}
