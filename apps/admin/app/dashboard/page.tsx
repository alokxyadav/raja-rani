'use client';

import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  totalRefunded: number;
  certificatesIssued: number;
  upcomingLiveClasses: number;
  communityPosts: number;
}

export default function DashboardPage() {
  // SWR re-fetches on focus/interval by default — the dashboard stays
  // live without a manual refresh button, and every value it shows comes
  // straight from real COUNT/SUM queries built in Phase 7 (never hard-coded).
  const { data, error, isLoading } = useSWR<DashboardMetrics>(
    '/api/v1/admin/dashboard',
    (path: string) => apiFetch<DashboardMetrics>(path),
    { refreshInterval: 30_000 },
  );

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load dashboard metrics. Are you logged in as an admin?</p>}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Users" value={data.totalUsers} />
          <MetricCard label="Active Users" value={data.activeUsers} />
          <MetricCard label="Published Courses" value={`${data.publishedCourses} / ${data.totalCourses}`} />
          <MetricCard label="Enrollments" value={data.totalEnrollments} />
          <MetricCard label="Revenue" value={`₹${data.totalRevenue.toLocaleString('en-IN')}`} accent />
          <MetricCard label="Refunded" value={`₹${data.totalRefunded.toLocaleString('en-IN')}`} />
          <MetricCard label="Certificates Issued" value={data.certificatesIssued} />
          <MetricCard label="Upcoming Live Classes" value={data.upcomingLiveClasses} />
          <MetricCard label="Community Posts" value={data.communityPosts} />
        </div>
      )}
    </AdminShell>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <p className="text-sm text-textMuted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
