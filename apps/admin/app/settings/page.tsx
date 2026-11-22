'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AdminShell from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

interface Settings {
  MIN_SUPPORTED_APP_VERSION: string;
  LATEST_APP_VERSION: string;
  FORCE_UPDATE: string;
  MAINTENANCE_MODE: string;
  LIVE_CLASSES_ENABLED: string;
  COMMUNITY_ENABLED: string;
}

export default function SettingsPage() {
  const { data, mutate } = useSWR<Settings>('/api/v1/settings', (p: string) => apiFetch(p));
  const [local, setLocal] = useState<Settings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (data) setLocal(data); }, [data]);

  async function saveField(key: keyof Settings, value: string) {
    setSaving(key);
    try {
      await apiFetch(`/api/v1/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
      mutate();
    } finally {
      setSaving(null);
    }
  }

  if (!local) return <AdminShell><p className="text-textMuted">Loading…</p></AdminShell>;

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">Platform Settings</h1>

      <div className="bg-surface border border-border rounded-card p-5 max-w-lg space-y-5">
        <ToggleRow
          label="Maintenance mode"
          description="Shows a maintenance screen to all students on next app open."
          value={local.MAINTENANCE_MODE === 'true'}
          onChange={(v) => saveField('MAINTENANCE_MODE', String(v))}
          busy={saving === 'MAINTENANCE_MODE'}
          danger
        />
        <ToggleRow
          label="Force update"
          description="Blocks users below the minimum version from using the app."
          value={local.FORCE_UPDATE === 'true'}
          onChange={(v) => saveField('FORCE_UPDATE', String(v))}
          busy={saving === 'FORCE_UPDATE'}
        />
        <TextRow
          label="Minimum supported version"
          value={local.MIN_SUPPORTED_APP_VERSION}
          onSave={(v) => saveField('MIN_SUPPORTED_APP_VERSION', v)}
          busy={saving === 'MIN_SUPPORTED_APP_VERSION'}
        />
        <TextRow
          label="Latest version"
          value={local.LATEST_APP_VERSION}
          onSave={(v) => saveField('LATEST_APP_VERSION', v)}
          busy={saving === 'LATEST_APP_VERSION'}
        />
        <ToggleRow
          label="Live classes enabled"
          description="Feature flag — hides the Live Classes tab platform-wide when off."
          value={local.LIVE_CLASSES_ENABLED === 'true'}
          onChange={(v) => saveField('LIVE_CLASSES_ENABLED', String(v))}
          busy={saving === 'LIVE_CLASSES_ENABLED'}
        />
        <ToggleRow
          label="Community enabled"
          description="Feature flag for the Community tab."
          value={local.COMMUNITY_ENABLED === 'true'}
          onChange={(v) => saveField('COMMUNITY_ENABLED', String(v))}
          busy={saving === 'COMMUNITY_ENABLED'}
        />
      </div>
      <p className="text-xs text-textMuted mt-4 max-w-lg">
        The mobile app doesn't read these flags yet (that's a mobile-side addition — the
        splash screen would call GET /api/v1/settings before showing Home) — this page
        writes real values the backend already serves.
      </p>
    </AdminShell>
  );
}

function ToggleRow({ label, description, value, onChange, busy, danger }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void; busy: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-textMuted">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={busy}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? (danger ? 'bg-error' : 'bg-primary') : 'bg-border'} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function TextRow({ label, value, onSave, busy }: { label: string; value: string; onSave: (v: string) => void; busy: boolean }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-medium text-sm">{label}</p>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className="border border-border rounded-lg px-2 py-1 text-sm w-28" />
        <button onClick={() => onSave(draft)} disabled={busy} className="text-primary text-sm font-semibold disabled:opacity-50">
          {busy ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
