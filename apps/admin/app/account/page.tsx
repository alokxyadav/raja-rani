'use client';

import { useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { apiFetch, ApiError } from '@/lib/api';

export default function AccountPage() {
  const [step, setStep] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [otpAuthUrl, setOtpAuthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function startSetup() {
    setError(null);
    try {
      const res = await apiFetch<{ secret: string; otpAuthUrl: string }>('/api/v1/auth/mfa/setup', { method: 'POST' });
      setSecret(res.secret);
      setOtpAuthUrl(res.otpAuthUrl);
      setStep('scanning');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start MFA setup.');
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid code, check your authenticator app and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-2">Account Security</h1>
      <p className="text-sm text-textMuted mb-6">
        Admin accounts benefit from two-factor authentication, the brief specifically calls for
        stronger protection on SUPER_ADMIN-level actions.
      </p>

      <div className="bg-surface border border-border rounded-card p-5 max-w-md">
        {step === 'idle' && (
          <>
            <p className="font-medium mb-3">Two-factor authentication</p>
            <button onClick={startSetup} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">
              Enable
            </button>
          </>
        )}

        {step === 'scanning' && otpAuthUrl && (
          <form onSubmit={confirmSetup}>
            <p className="font-medium mb-2">Scan this into your authenticator app</p>
            <p className="text-xs text-textMuted mb-3">
              Google Authenticator, Authy, 1Password, etc. No QR image renders here, but any
              app can add an account manually using the secret below.
            </p>
            <div className="bg-background border border-border rounded-lg px-3 py-2 mb-4 font-mono text-sm break-all">
              {secret}
            </div>
            <label className="block text-sm font-medium mb-1">Enter the 6-digit code to confirm</label>
            <input
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-border rounded-lg px-3 py-2 mb-4 text-center text-xl tracking-[0.4em] font-mono"
            />
            {error && <p className="text-error text-sm mb-4">{error}</p>}
            <button type="submit" disabled={submitting} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
              {submitting ? 'Confirming…' : 'Confirm & enable'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p className="text-success font-medium">Two-factor authentication is enabled. A code will be required on every future login.</p>
        )}

        {error && step !== 'scanning' && <p className="text-error text-sm mt-3">{error}</p>}
      </div>
    </AdminShell>
  );
}
