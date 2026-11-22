import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  ready() {
    // Phase 1: liveness only. Add a real DB ping (prisma.$queryRaw`SELECT 1`)
    // once PrismaService is injected here — trivial, deferred to keep this
    // file dependency-free for now.
    return { status: 'ready' };
  }
}
