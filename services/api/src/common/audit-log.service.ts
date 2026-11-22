import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  // Fire-and-forget-shaped but awaited: callers `await` this so a failed
  // audit write surfaces as a real error rather than silently vanishing.
  // metadata must never contain secrets/tokens — callers pass only safe,
  // already-redacted summaries (e.g. {from: 'ACTIVE', to: 'SUSPENDED'}).
  async log(actorId: string, action: string, resource: string, resourceId: string, metadata?: object) {
    return this.prisma.auditLog.create({
      data: { actorId, action, resource, resourceId, metadata: metadata ?? undefined },
    });
  }
}
