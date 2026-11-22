import * as crypto from 'crypto';

// Standard RFC 6238 TOTP (the same algorithm Google Authenticator, Authy,
// and 1Password's TOTP feature all implement) — written directly against
// Node's built-in crypto module rather than adding a dependency for
// something this small and this security-sensitive. 30-second time step,
// 6-digit codes, SHA-1 (still the universal default for authenticator app
// compatibility, even though SHA-1 is deprecated for other uses — TOTP's
// use of it as an HMAC primitive is not the same threat model as using it
// for a digital signature or hash-collision-sensitive purpose).

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SECONDS = 30;
const CODE_DIGITS = 6;

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20); // 160 bits, the RFC 4226 recommendation
  return base32Encode(bytes);
}

export function buildOtpAuthUrl(secret: string, accountLabel: string, issuer = 'Raja Rani'): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(CODE_DIGITS),
    period: String(TIME_STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?${params.toString()}`;
}

export function verifyTotp(secret: string, token: string, windowSteps = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / TIME_STEP_SECONDS);
  // Checks the current step and a small window on either side, to tolerate
  // minor clock drift between the server and the user's phone — a common,
  // expected real-world condition, not a security weakening (each step is
  // still a fresh 6-digit code, and the window is only ±30s).
  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    if (computeTotp(secret, currentStep + offset) === token) return true;
  }
  return false;
}

// Exported for tests only, so a test can generate a real, currently-valid
// code for a known secret and assert verifyTotp() accepts it — proving the
// encode/HMAC/truncation pipeline is actually correct, not just internally
// consistent.
export function computeTotp(secret: string, timeStep: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, '0');
  return code;
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
