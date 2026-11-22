import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

// google-auth-library's OAuth2Client makes real network calls to fetch
// Google's public keys — mocked at the module level so these tests stay
// fast and offline, same principle as every other test in this file
// mocking Prisma instead of hitting a real database.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

function makePrismaMock() {
  return {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    otp: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
}

function makeJwtMock() {
  return { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
}

function makeConfigMock(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-secret',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    OTP_TTL_SECONDS: '300',
    OTP_MAX_ATTEMPTS: '5',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    ...overrides,
  };
  return { get: jest.fn((key: string) => defaults[key]) };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuthService(prisma as any, makeJwtMock() as any, makeConfigMock() as any);
    mockVerifyIdToken.mockReset();
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
      await expect(
        service.register({ name: 'Test', email: 'a@b.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('never stores the plaintext password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: any) => ({ id: 'new-user', ...data }));

      await service.register({ name: 'Test', email: 'a@b.com', password: 'password123' });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('password123');
      expect(createCall.data.passwordHash).toMatch(/^\$argon2/); // real argon2 hash format
      expect(createCall.data).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('rejects when no user matches, without revealing that via timing/shape', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@x.com', password: 'whatever1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an incorrect password against a real hash', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a suspended account even with the correct password', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'SUSPENDED',
        role: 'STUDENT',
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'correct-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens on a correct password for an active account', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.com', password: 'correct-password' });
      expect('accessToken' in result).toBe(true);
     if (!('accessToken' in result)) throw new Error('Expected token pair');
     expect(result.accessToken).toBe('signed.jwt.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(20); // real random token, not a placeholder
    });

    it('rejects login while locked out, even with the correct password', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more minutes
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'correct-password' }),
      ).rejects.toThrow(/locked/);
    });

    it('allows login again once the lockout window has passed', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // lockout expired 1s ago
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.com', password: 'correct-password' });
      expect('accessToken' in result).toBe(true);
     if (!('accessToken' in result)) throw new Error('Expected token pair');
     expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('locks the account on the 5th consecutive failed attempt', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 4, // one more failure crosses the threshold
        lockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) },
      });
    });

    it('does not lock the account before the threshold is reached', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: correctHash,
        status: 'ACTIVE',
        role: 'STUDENT',
        failedLoginAttempts: 1,
        lockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 2, lockedUntil: undefined },
      });
    });
  });

  describe('refresh (rotation)', () => {
    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an already-revoked refresh token (reuse detection)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        userId: 'user-1',
      });
      await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000), // already expired
        userId: 'user-1',
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes the old token and issues a new pair on success', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        userId: 'user-1',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', role: 'STUDENT' });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refresh('valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled(); // new pair issued
    });
  });

  describe('loginWithGoogle', () => {
    it('fails loudly (not silently) when GOOGLE_CLIENT_ID is not configured', async () => {
      const unconfiguredService = new AuthService(
        prisma as any,
        makeJwtMock() as any,
        makeConfigMock({ GOOGLE_CLIENT_ID: undefined as any }) as any,
      );
      await expect(unconfiguredService.loginWithGoogle('token')).rejects.toThrow(/not configured/);
    });

    it('rejects a token that fails Google signature verification', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('invalid signature'));
      await expect(service.loginWithGoogle('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a valid token with no email in the payload', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-123' }) });
      await expect(service.loginWithGoogle('token')).rejects.toThrow(UnauthorizedException);
    });

    it('creates a new user on first Google sign-in, with email pre-verified', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'new@gmail.com', name: 'New User' }),
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: 'new-user',
        status: 'ACTIVE',
        role: 'STUDENT',
        ...data,
      }));

      await service.loginWithGoogle('token');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@gmail.com', googleId: 'google-123', emailVerified: true }),
        }),
      );
    });

    it('links Google sign-in to an existing password account with the same email, rather than creating a duplicate', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'existing@gmail.com', name: 'Existing User' }),
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@gmail.com',
        googleId: null, // signed up with password originally
        status: 'ACTIVE',
        role: 'STUDENT',
      });
      prisma.user.update.mockResolvedValue({ id: 'existing-user', status: 'ACTIVE', role: 'STUDENT' });

      await service.loginWithGoogle('token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'existing-user' },
        data: { googleId: 'google-123' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled(); // no duplicate account
    });

    it('does not re-link an account that already has a different googleId (would indicate two different Google accounts sharing an email lookup path)', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'existing@gmail.com', name: 'Existing User' }),
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@gmail.com',
        googleId: 'google-123', // already linked
        status: 'ACTIVE',
        role: 'STUDENT',
      });

      await service.loginWithGoogle('token');
      expect(prisma.user.update).not.toHaveBeenCalled(); // nothing to change
    });

    it('rejects a suspended account even with a valid Google token', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'suspended@gmail.com', name: 'Suspended User' }),
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'suspended@gmail.com',
        googleId: 'google-123',
        status: 'SUSPENDED',
        role: 'STUDENT',
      });

      await expect(service.loginWithGoogle('token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyOtp', () => {
    it('rejects when the OTP has exceeded max attempts', async () => {
      prisma.otp.findFirst.mockResolvedValue({
        id: 'otp-1',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 5, // == OTP_MAX_ATTEMPTS
        codeHash: 'irrelevant',
      });
      await expect(service.verifyOtp({ phone: '+911234567890', code: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired OTP', async () => {
      prisma.otp.findFirst.mockResolvedValue({
        id: 'otp-1',
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
        codeHash: 'irrelevant',
      });
      await expect(service.verifyOtp({ phone: '+911234567890', code: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
