'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  accessType: 'FREE' | 'PAID';
  price: string | null;
}

export default function CoursesPage() {
  const { data, error, isLoading, mutate } = useSWR<Course[]>(
    '/api/v1/courses/admin/all',
    (path: string) => apiFetch(path),
  );
  const [showCreate, setShowCreate] = useState(false);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Courses</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + New Course
        </button>
      </div>

      {showCreate && <CreateCourseForm onDone={() => { setShowCreate(false); mutate(); }} />}

      {isLoading && <p className="text-textMuted">Loading…</p>}
      {error && <p className="text-error">Could not load courses.</p>}

      {data && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-textMuted text-left">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((course) => (
                <CourseRow key={course.id} course={course} onChanged={mutate} />
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-textMuted">No courses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function CourseRow({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handlePublish() {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/courses/${course.id}/publish`, { method: 'POST' });
      onChanged();
    } catch (e) {
      // Surfaces the server's actual validation message (e.g. "missing:
      // thumbnailUrl, at least one chapter") rather than a generic failure —
      // this is exactly the publish-validation built in courses.service.ts.
      setActionError(e instanceof ApiError ? e.message : 'Could not publish.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">
        <Link href={`/courses/${course.id}`} className="hover:text-primary hover:underline">
          {course.title}
        </Link>
      </td>
      <td className="px-4 py-3">{course.accessType}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            course.status === 'PUBLISHED'
              ? 'bg-success/10 text-success'
              : 'bg-textMuted/10 text-textMuted'
          }`}
        >
          {course.status}
        </span>
      </td>
      <td className="px-4 py-3">{course.price ? `₹${course.price}` : '—'}</td>
      <td className="px-4 py-3 text-right">
        <Link href={`/courses/${course.id}`} className="text-primary text-sm font-semibold mr-3">
          Manage
        </Link>
        {course.status !== 'PUBLISHED' && (
          <button onClick={handlePublish} disabled={busy} className="text-primary text-sm font-semibold disabled:opacity-50">
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
      </td>
    </tr>
  );
}

function CreateCourseForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [accessType, setAccessType] = useState<'FREE' | 'PAID'>('FREE');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/courses', {
        method: 'POST',
        body: JSON.stringify({
          title,
          accessType,
          ...(accessType === 'PAID' ? { price: Number(price) } : {}),
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create course.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 mb-6">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Access</label>
          <select
            value={accessType}
            onChange={(e) => setAccessType(e.target.value as 'FREE' | 'PAID')}
            className="w-full border border-border rounded-lg px-3 py-2"
          >
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>
      {accessType === 'PAID' && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Price (₹)</label>
          <input
            required
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full max-w-xs border border-border rounded-lg px-3 py-2"
          />
        </div>
      )}
      {error && <p className="text-error text-sm mb-4">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create draft'}
      </button>
      <p className="text-xs text-textMuted mt-2">
        Created as a draft — add chapters/lessons via the API, then publish (server validates required fields).
      </p>
    </form>
  );
}
