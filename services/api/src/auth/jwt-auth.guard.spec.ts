import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let config: { get: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    config = { get: jest.fn().mockReturnValue('test-secret') };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) }; // not @Public() by default
    guard = new JwtAuthGuard(jwt as any, config as any, reflector as any);
  });

  it('allows a route marked @Public() without checking for a token at all', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = makeContext(); // no authorization header
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const context = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a header that is not a Bearer token', async () => {
    const context = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token (jwt.verifyAsync throwing TokenExpiredError)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = makeContext({ authorization: 'Bearer expired.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed/tampered token (jwt.verifyAsync throwing JsonWebTokenError)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const context = makeContext({ authorization: 'Bearer tampered.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('never leaks the underlying jwt library error message to the client', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('some internal jwt library detail'));
    const context = makeContext({ authorization: 'Bearer x.y.z' });
    try {
      await guard.canActivate(context);
      fail('expected canActivate to throw');
    } catch (e) {
      expect((e as Error).message).not.toContain('internal jwt library detail');
      expect((e as Error).message).toBe('invalid or expired access token');
    }
  });

  it('attaches the decoded user (id, role) to the request on success', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'STUDENT' });
    const request: any = { headers: { authorization: 'Bearer valid.token.here' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);
    expect(request.user).toEqual({ id: 'user-1', role: 'STUDENT' });
  });
});
