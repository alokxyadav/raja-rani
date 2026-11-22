import { generateTotpSecret, verifyTotp, buildOtpAuthUrl, computeTotp } from './totp.util';

describe('TOTP', () => {
  it('generates a base32 secret of reasonable length', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/); // valid base32 alphabet only
    expect(secret.length).toBeGreaterThanOrEqual(32); // 160 bits encoded
  });

  it('produces a different secret on every call', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });

  it('rejects a code that is not exactly 6 digits', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '123')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('rejects an arbitrary wrong code against a real secret', () => {
    const secret = generateTotpSecret();
    // Astronomically unlikely to collide with the actual current code; if
    // it ever does, that's TOTP's inherent 1-in-a-million false-accept
    // rate for a 6-digit code, not a bug in this test.
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('accepts a code it generated itself for the current time step', () => {
    const secret = generateTotpSecret();
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const code = computeTotp(secret, currentStep);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('accepts a code from one step in the past (clock drift tolerance)', () => {
    const secret = generateTotpSecret();
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const previousStepCode = computeTotp(secret, currentStep - 1);
    expect(verifyTotp(secret, previousStepCode)).toBe(true);
  });

  it('rejects a code from far outside the drift window', () => {
    const secret = generateTotpSecret();
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const farPastCode = computeTotp(secret, currentStep - 10); // 5 minutes ago
    expect(verifyTotp(secret, farPastCode)).toBe(false);
  });

  it('produces different codes for different secrets at the same time step', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const step = Math.floor(Date.now() / 1000 / 30);
    expect(computeTotp(secretA, step)).not.toBe(computeTotp(secretB, step));
  });

  it('matches the RFC 6238 SHA-1 test vector at time step 1 (T=59s)', () => {
    // The official RFC 6238 Appendix B test secret ("12345678901234567890"
    // ASCII, base32-encoded), used here to prove this implementation is
    // actually RFC-compliant and not just self-consistent.
    const rfcSecretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(computeTotp(rfcSecretBase32, 1)).toBe('287082');
  });

  it('builds a valid otpauth:// URL with the expected parameters', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const url = buildOtpAuthUrl(secret, 'admin@dev.local');
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });
});
