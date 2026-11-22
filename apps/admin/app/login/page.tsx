'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setToken } from '@/lib/api';

type LoginResponse =
  | { accessToken: string; refreshToken: string }
  | { mfaRequired: true; mfaToken: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Two-step flow: null = password step, a token = MFA code step. Kept as
  // local state rather than a route change — the brief calls for admin
  // sessions to have stronger security, and a full page navigation
  // mid-login is an unnecessary extra step for something this quick.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  function completeLogin(res: { accessToken: string; refreshToken: string }) {
    setToken(res.accessToken);
    // The redirect below is a convenience only — every admin endpoint
    // still enforces @Roles('ADMIN') server-side. A non-admin who reaches
    // this point simply gets 403s on every subsequent call, surfaced by
    // the dashboard page as an error rather than a crash.
    router.push('/dashboard');
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if ('mfaRequired' in res) {
        setMfaToken(res.mfaToken);
      } else {
        completeLogin(res);
      }
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ accessToken: string; refreshToken: string }>(
        '/api/v1/auth/mfa/verify-login',
        { method: 'POST', body: JSON.stringify({ mfaToken, code: mfaCode }) },
      );
      completeLogin(res);
    } catch (err) {
      setError('Incorrect or expired code.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={mfaToken ? handleMfaSubmit : handlePasswordSubmit}
        className="w-full max-w-sm bg-surface border border-border rounded-card p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-primary mb-1">Raja Rani Admin</h1>
        <p className="text-textMuted text-sm mb-6">
          {mfaToken ? 'Enter your 6-digit authenticator code' : 'Sign in with your admin account'}
        </p>

        {!mfaToken ? (
          <>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full border border-border rounded-lg px-3 py-2 mb-4 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {error && <p className="text-error text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
        >
          {submitting ? 'Verifying…' : mfaToken ? 'Verify' : 'Sign in'}
        </button>

        {mfaToken && (
          <button
            type="button"
            onClick={() => { setMfaToken(null); setMfaCode(''); setError(null); }}
            className="w-full text-textMuted text-sm mt-3"
          >
            Back to password
          </button>
        )}
      </form>
    </div>
  );
}
