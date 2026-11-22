'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

interface Report {
  id: string;
  resourceType: 'COMMUNITY_POST' | 'COMMUNITY_COMMENT' | 'REVIEW';
  resourceId: string;
  reason: string;
  createdAt: string;
  reporter: { name: string };
}

const RESOURCE_LABELS: Record<string, string> = {
  COMMUNITY_POST: 'Community post',
  COMMUNITY_COMMENT: 'Community comment',
  REVIEW: 'Review',
};

export default function ReportsPage() {
  const { data, error, isLoading, mutate } = useSWR<Report[]>('/api/v1/admin/reports', (p: string) => apiFetch(p));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-2">Reports</h1>
      <p className="text-sm text-textMuted mb-6">
        Resolving a report clears it from this queue, it does not delete the reported content.
        Use Community or Courses to actually moderate/remove content.
      </p>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load reports.</p>}

      {data && (
        <div className="space-y-3">
          {data.map((report) => (
            <ReportCard key={report.id} report={report} onChanged={mutate} />
          ))}
          {data.length === 0 && <p className="text-textMuted">No unresolved reports. 🎉</p>}
        </div>
      )}
    </AdminShell>
  );
}

function ReportCard({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleResolve() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/admin/reports/${report.id}/resolve`, { method: 'POST' });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card p-4 flex items-start justify-between">
      <div>
        <p className="font-semibold text-sm">
          {RESOURCE_LABELS[report.resourceType]} · <span className="font-mono text-xs text-textMuted">{report.resourceId.slice(0, 8)}…</span>
        </p>
        <p className="text-sm mt-1">{report.reason}</p>
        <p className="text-xs text-textMuted mt-1">
          Reported by {report.reporter.name} · {new Date(report.createdAt).toLocaleString()}
        </p>
      </div>
      <button onClick={handleResolve} disabled={busy} className="text-primary text-sm font-semibold whitespace-nowrap disabled:opacity-50">
        {busy ? 'Working…' : 'Mark resolved'}
      </button>
    </div>
  );
}
