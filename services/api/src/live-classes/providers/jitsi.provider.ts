import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { LiveClassProvider } from './live-class-provider.interface';

// Public meet.jit.si rooms need no account/API key, which makes this the
// one provider in the whole stack that actually works with zero setup —
// useful for getting live classes end-to-end testable immediately. It is
// NOT what you want for production: rooms are joinable by anyone who
// guesses the room name (mitigated below with a random suffix, but that's
// obscurity, not real access control), no recording, no participant caps.
// Swap in LiveKitProvider or AgoraProvider (same interface) before launch —
// see docs/LIVE_CLASSES.md.
@Injectable()
export class JitsiProvider implements LiveClassProvider {
  readonly name = 'jitsi';

  generateJoinUrl(liveClassId: string, _userId: string, _role: 'host' | 'participant'): string {
    const roomSuffix = crypto
      .createHash('sha256')
      .update(liveClassId + (process.env.JWT_ACCESS_SECRET ?? 'dev-salt'))
      .digest('hex')
      .slice(0, 16);
    return `https://meet.jit.si/rajarani-${roomSuffix}`;
  }
}
