'use client';

import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

interface AuditLog {
  id: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const { data, error, isLoading } = useSWR<AuditLog[]>('/api/v1/admin/audit-logs', (p: string) => apiFetch(p));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-2">Audit Logs</h1>
      <p className="text-sm text-textMuted mb-6">Every sensitive admin action (suspensions, etc.) is recorded automatically — nothing here is manually logged.</p>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load audit logs.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{log.actorName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-textMuted">{log.resource} · {log.resourceId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs text-textMuted">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-textMuted">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-textMuted">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
