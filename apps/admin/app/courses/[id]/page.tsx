'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  order: number;
  contentType: 'VIDEO' | 'PDF' | 'RESOURCE_LINK';
  videoAssetId: string | null;
  isFreePreview: boolean;
}
interface Chapter {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}
interface CourseDetail {
  id: string;
  title: string;
  status: string;
  accessType: string;
  chapters: Chapter[];
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const { data, error, isLoading, mutate } = useSWR<CourseDetail>(
    `/api/v1/courses/admin/${courseId}`,
    (p: string) => apiFetch(p),
  );
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishError(null);
    try {
      await apiFetch(`/api/v1/courses/${courseId}/publish`, { method: 'POST' });
      mutate();
    } catch (e) {
      // Surfaces courses.service.ts's real validation message, e.g.
      // "missing: thumbnailUrl, at least one chapter", exactly what an
      // admin needs to see to fix the course, not a generic failure.
      setPublishError(e instanceof ApiError ? e.message : 'Could not publish.');
    }
  }

  if (isLoading) return <AdminShell><p className="text-textMuted">Loading…</p></AdminShell>;
  if (error || !data) return <AdminShell><p className="text-error">Could not load this course.</p></AdminShell>;

  return (
    <AdminShell>
      <button onClick={() => router.push('/courses')} className="text-sm text-textMuted mb-4">Back to Courses</button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            data.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 'bg-textMuted/10 text-textMuted'
          }`}>
            {data.status}
          </span>
        </div>
        {data.status !== 'PUBLISHED' && (
          <button onClick={handlePublish} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Publish
          </button>
        )}
      </div>
      {publishError && (
        <p className="text-error text-sm mb-4 bg-error/5 border border-error/20 rounded-lg px-3 py-2">{publishError}</p>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Chapters</h2>
        <button onClick={() => setShowChapterForm(true)} className="text-primary text-sm font-semibold">
          + Add chapter
        </button>
      </div>

      {showChapterForm && (
        <ChapterForm
          courseId={courseId}
          nextOrder={data.chapters.length + 1}
          onDone={() => { setShowChapterForm(false); mutate(); }}
        />
      )}

      <div className="space-y-4">
        {data.chapters.map((chapter) => (
          <ChapterCard key={chapter.id} chapter={chapter} onChanged={mutate} />
        ))}
        {data.chapters.length === 0 && (
          <p className="text-textMuted text-sm">
            No chapters yet, this course can't be published until it has at least one.
          </p>
        )}
      </div>
    </AdminShell>
  );
}

function ChapterForm({ courseId, nextOrder, onDone }: { courseId: string; nextOrder: number; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/courses/${courseId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({ title, order: nextOrder }),
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-4 mb-4 flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1">Chapter title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
        {submitting ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}

function ChapterCard({ chapter, onChanged }: { chapter: Chapter; onChanged: () => void }) {
  const [showLessonForm, setShowLessonForm] = useState(false);

  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold">{chapter.title}</p>
        <button onClick={() => setShowLessonForm((v) => !v)} className="text-primary text-sm font-semibold">
          + Add lesson
        </button>
      </div>

      {showLessonForm && (
        <LessonForm
          chapterId={chapter.id}
          nextOrder={chapter.lessons.length + 1}
          onDone={() => { setShowLessonForm(false); onChanged(); }}
        />
      )}

      <div className="divide-y divide-border">
        {chapter.lessons.map((lesson) => (
          <div key={lesson.id} className="py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span>{lesson.contentType === 'VIDEO' ? 'Video:' : lesson.contentType === 'PDF' ? 'PDF:' : 'Link:'}</span>
              <span>{lesson.title}</span>
              {lesson.isFreePreview && (
                <span className="text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">Free preview</span>
              )}
            </div>
            {lesson.contentType === 'VIDEO' && (
              <span className={`text-xs ${lesson.videoAssetId ? 'text-success' : 'text-error'}`}>
                {lesson.videoAssetId ? 'Video attached' : 'No video yet'}
              </span>
            )}
          </div>
        ))}
        {chapter.lessons.length === 0 && (
          <p className="text-textMuted text-xs py-2">No lessons yet.</p>
        )}
      </div>
    </div>
  );
}

function LessonForm({ chapterId, nextOrder, onDone }: { chapterId: string; nextOrder: number; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'VIDEO' | 'PDF' | 'RESOURCE_LINK'>('VIDEO');
  const [resourceUrl, setResourceUrl] = useState('');
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let videoAssetId: string | undefined;

      if (contentType === 'VIDEO') {
        if (!videoFile) throw new Error('Choose a video file first.');
        // Two-step flow matching video.service.ts exactly: get a direct
        // upload URL, upload the file straight to Cloudflare from this
        // browser (never through our own API server), then attach the
        // resulting asset ID to the lesson.
        setUploadProgress('Requesting upload URL…');
        const uploadRes = await apiFetch<{ uploadUrl: string; videoAssetId: string }>(
          '/api/v1/lessons/video-upload-url',
          { method: 'POST', body: JSON.stringify({}) },
        );

        setUploadProgress('Uploading video (large files can take a while; the direct-upload endpoint used here supports files up to 200MB — see docs/VIDEO.md for the TUS resumable-upload alternative Cloudflare offers for larger files, not implemented here)…');
        const formData = new FormData();
        formData.append('file', videoFile);
        const uploadResponse = await fetch(uploadRes.uploadUrl, { method: 'POST', body: formData });
        if (!uploadResponse.ok) throw new Error('Video upload to Cloudflare failed.');

        videoAssetId = uploadRes.videoAssetId;
        setUploadProgress('Attaching to lesson…');
      }

      const lessonRes = await apiFetch<{ id: string }>(`/api/v1/courses/chapters/${chapterId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          order: nextOrder,
          contentType,
          isFreePreview,
          ...(contentType === 'VIDEO' ? { videoAssetId } : {}),
          ...(contentType === 'PDF' ? { pdfUrl: resourceUrl } : {}),
          ...(contentType === 'RESOURCE_LINK' ? { resourceUrl } : {}),
        }),
      });

      if (contentType === 'VIDEO' && videoAssetId) {
        await apiFetch(`/api/v1/lessons/${lessonRes.id}/attach-video`, {
          method: 'POST',
          body: JSON.stringify({ videoAssetId }),
        });
      }

      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not add lesson.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-border rounded-lg p-4 mb-3 space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Lesson title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select value={contentType} onChange={(e) => setContentType(e.target.value as any)} className="w-full border border-border rounded-lg px-3 py-2">
          <option value="VIDEO">Video</option>
          <option value="PDF">PDF</option>
          <option value="RESOURCE_LINK">External link</option>
        </select>
      </div>
      {contentType === 'VIDEO' ? (
        <div>
          <label className="block text-sm font-medium mb-1">Video file</label>
          <input
            type="file"
            accept="video/*"
            required
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">{contentType === 'PDF' ? 'PDF URL' : 'Link URL'}</label>
          <input required value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2" />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} />
        Free preview (watchable without enrolling)
      </label>
      {uploadProgress && <p className="text-primary text-sm">{uploadProgress}</p>}
      {error && <p className="text-error text-sm">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
        {submitting ? 'Saving…' : 'Add lesson'}
      </button>
    </form>
  );
}
