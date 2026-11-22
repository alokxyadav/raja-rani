'use client';

import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

interface Certificate {
  id: string;
  certificateNo: string;
  issuedAt: string;
  user: { name: string; email: string | null };
  course: { title: string };
}

export default function CertificatesAdminPage() {
  const { data, error, isLoading } = useSWR<Certificate[]>('/api/v1/admin/certificates', (p: string) => apiFetch(p));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Certificates</h1>

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load certificates.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Certificate No.</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Issued</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cert) => (
                <tr key={cert.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{cert.certificateNo}</td>
                  <td className="px-4 py-3">{cert.user.name}</td>
                  <td className="px-4 py-3">{cert.course.title}</td>
                  <td className="px-4 py-3 text-textMuted text-xs">{new Date(cert.issuedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-textMuted">No certificates issued yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-textMuted mt-4">
        Every row here was issued automatically — completion recomputed from real progress data, never manually toggled. See docs/CERTIFICATES logic in certificates.service.ts.
      </p>
    </AdminShell>
  );
}
