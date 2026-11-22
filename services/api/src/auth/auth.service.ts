import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma.service';
import { LoginDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from './totp.util';

// Throttling for OTP/login endpoints is enforced at the controller level
// via @nestjs/throttler's @Throttle() decorator — see auth.controller.ts.

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ---------- Registration (email/password) ----------

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('email or phone is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (existing) throw new ConflictException('account already exists');

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    return this.issueTokens(user.id, user.role);
  }

  // ---------- Login (email/phone + password) ----------

  // Per-account lockout thresholds. Rate limiting on the endpoint
  // (auth.controller.ts's @Throttle) already blunts a single-IP brute
  // force; this adds the complementary defense — a distributed attack
  // spread across many IPs still can't grind one account indefinitely.
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_MINUTES = 15;

  async login(dto: LoginDto): Promise<TokenPair | MfaChallenge> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('email or phone is required');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
    });

    // Constant-shape response whether the user exists or not, to avoid
    // leaking account existence via timing/response differences.
    if (!user || !user.passwordHash) {
      await argon2.hash('dummy-to-equalize-timing');
      throw new UnauthorizedException('invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Deliberately a distinct message from "invalid credentials" — the
      // account owner benefits from knowing why they're locked out (so
      // they stop retrying and just wait), and this doesn't leak anything
      // an attacker didn't already learn by triggering the lockout
      // themselves.
      throw new UnauthorizedException(
        `account temporarily locked after too many failed attempts — try again in a few minutes`,
      );
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('account is not active');
    }

    // Successful login clears any accumulated failure count — a user who
    // mistypes their password twice then gets it right shouldn't be
    // creeping toward a lockout from stale attempts.
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Password verified, but that's only the first factor for an
    // MFA-enabled account (in practice: admins, per the brief's "SUPER_ADMIN
    // actions should be especially protected"). Return a short-lived
    // challenge instead of real tokens — the client must call
    // /auth/mfa/verify-login with a valid TOTP code before getting a
    // session.
    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, purpose: 'mfa_challenge' },
        { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.issueTokens(user.id, user.role);
  }

  // ---------- MFA (TOTP) ----------

  // Step 1 of enabling MFA: generate a secret and return it as a QR-code
  // URL for the user to scan into an authenticator app. Not yet enabled —
  // the secret is stored but mfaEnabled stays false until enableMfa()
  // confirms the user can actually generate a valid code with it (proves
  // the scan worked, rather than enabling blind and potentially locking
  // the user out of their own account).
  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('user not found');

    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    return {
      secret, // shown once for manual entry if the user can't scan a QR code
      otpAuthUrl: buildOtpAuthUrl(secret, user.email ?? user.phone ?? userId),
    };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException('call /auth/mfa/setup first');
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new UnauthorizedException('invalid code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('incorrect password');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }

  // Step 2 of logging in with MFA: exchange the short-lived challenge from
  // login() plus a valid TOTP code for a real session.
  async verifyMfaLogin(mfaToken: string, code: string): Promise<TokenPair> {
    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(mfaToken, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('MFA challenge expired — please log in again');
    }
    if (payload.purpose !== 'mfa_challenge') {
      throw new UnauthorizedException('invalid challenge token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.mfaSecret || !user.mfaEnabled) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new UnauthorizedException('invalid code');
    }

    return this.issueTokens(user.id, user.role);
  }

  private async recordFailedLogin(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    const shouldLock = attempts >= AuthService.MAX_FAILED_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + AuthService.LOCKOUT_MINUTES * 60 * 1000)
          : undefined,
      },
    });
  }

  // ---------- OTP flow (phone) ----------

  async requestOtp(dto: RequestOtpDto) {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await argon2.hash(code);
    const ttlSeconds = Number(this.config.get('OTP_TTL_SECONDS') ?? 300);

    await this.prisma.otp.create({
      data: {
        target: dto.phone,
        codeHash,
        purpose: dto.purpose,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    // TODO(external-credential): send `code` via the configured SMS provider
    // (SMS_PROVIDER in .env). Not implemented here because it requires a live
    // MSG91/Twilio account — see docs/NOTIFICATIONS.md for the adapter interface
    // to implement. This is the one deliberate stub in Phase 1, and it's
    // stubbed because it needs a real account, not because it's hard.
    return { message: 'OTP sent', expiresInSeconds: ttlSeconds };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otp.findFirst({
      where: { target: dto.phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new UnauthorizedException('no active OTP for this number');
    if (otp.expiresAt < new Date()) throw new UnauthorizedException('OTP expired');

    const maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS') ?? 5);
    if (otp.attempts >= maxAttempts) {
      throw new UnauthorizedException('too many attempts, request a new OTP');
    }

    const valid = await argon2.verify(otp.codeHash, dto.code);
    if (!valid) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('invalid OTP');
    }

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { name: 'Student', phone: dto.phone, phoneVerified: true },
      });
    } else if (!user.phoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }

    return this.issueTokens(user.id, user.role);
  }

  // ---------- Google Sign-In ----------

  // Verifies the ID token's signature and audience against Google's own
  // public keys (google-auth-library fetches and caches those — this
  // never trusts a client-asserted email/name, only what Google itself
  // signed). Requires GOOGLE_CLIENT_ID (an OAuth 2.0 Web/Android client ID
  // from Google Cloud Console) — without it, this fails loudly rather
  // than silently accepting any token, same pattern as every other
  // provider in this codebase that needs a real external credential.
  async loginWithGoogle(idToken: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new Error('Google Sign-In is not configured — set GOOGLE_CLIENT_ID in .env.');
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('invalid Google token');
    }
    if (!payload?.email) {
      throw new UnauthorizedException('Google account has no verified email');
    }

    // Link-or-create: an existing password/OTP account with the same
    // email gets linked (googleId attached) rather than creating a
    // duplicate account — the alternative (always creating a new user)
    // would silently split one person's enrollments/orders/certificates
    // across two accounts the first time they used a different login
    // method.
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: payload.name ?? payload.email.split('@')[0],
          email: payload.email,
          googleId: payload.sub,
          emailVerified: true, // Google already verified it
          avatarUrl: payload.picture,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('account is not active');
    }

    return this.issueTokens(user.id, user.role);
  }

  // ---------- Token issuance & rotation ----------

  private async issueTokens(userId: string, role: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    const ttlDays = Number((this.config.get('JWT_REFRESH_TTL') as string)?.replace('d', '')) || 30;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('invalid or expired refresh token');
    }

    // Rotate: revoke the used token, issue a brand new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('account is not active');
    }

    return this.issueTokens(user.id, user.role);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Explicit select rather than returning the whole row — passwordHash,
      // mfaSecret, failedLoginAttempts etc. must never leave this method.
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('user not found');
    return user;
  }
}
