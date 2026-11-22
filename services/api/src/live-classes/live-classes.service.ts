import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EntitlementService } from '../enrollments/entitlement.service';
import { JitsiProvider } from './providers/jitsi.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLiveClassDto, EndLiveClassDto } from './dto/live-class.dto';

@Injectable()
export class LiveClassesService {
  constructor(
    private prisma: PrismaService,
    private entitlement: EntitlementService,
    private provider: JitsiProvider,
    private notifications: NotificationsService,
  ) {}

  // ---- admin ----

  create(dto: CreateLiveClassDto) {
    return this.prisma.liveClass.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        instructorName: dto.instructorName,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        status: 'SCHEDULED',
      },
    });
  }

  async start(id: string) {
    const liveClass = await this.findOrThrow(id);
    if (liveClass.status !== 'SCHEDULED') {
      throw new BadRequestException(`cannot start a class in ${liveClass.status} state`);
    }
    const updated = await this.prisma.liveClass.update({ where: { id }, data: { status: 'LIVE' } });

    // Notify everyone who set a reminder — best-effort, doesn't block the
    // class from actually starting if notification delivery has an issue.
    const remindedParticipants = await this.prisma.liveClassParticipant.findMany({
      where: { liveClassId: id, reminderSet: true },
    });
    for (const p of remindedParticipants) {
      await this.notifications.notify(
        p.userId,
        'LIVE_CLASS_REMINDER',
        `${liveClass.title} is live now`,
        'Tap to join the session.',
        `rajarani://live/${id}`,
      );
    }

    return updated;
  }

  async end(id: string, dto: EndLiveClassDto) {
    const liveClass = await this.findOrThrow(id);
    if (liveClass.status !== 'LIVE') {
      throw new BadRequestException(`cannot end a class in ${liveClass.status} state`);
    }
    return this.prisma.liveClass.update({
      where: { id },
      data: { status: 'ENDED', recordingUrl: dto.recordingUrl },
    });
  }

  async cancel(id: string) {
    const liveClass = await this.findOrThrow(id);
    if (liveClass.status === 'ENDED' || liveClass.status === 'CANCELLED') {
      throw new BadRequestException(`cannot cancel a class in ${liveClass.status} state`);
    }
    return this.prisma.liveClass.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ---- student ----

  listUpcoming(courseId?: string) {
    return this.prisma.liveClass.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async setReminder(userId: string, liveClassId: string) {
    await this.findOrThrow(liveClassId);
    return this.prisma.liveClassParticipant.upsert({
      where: { liveClassId_userId: { liveClassId, userId } },
      update: { reminderSet: true },
      create: { liveClassId, userId, reminderSet: true },
    });
  }

  // Matches the brief's per-state join behavior: only a LIVE class returns
  // a joinable URL. Eligibility mirrors course-content rules — a live class
  // tied to a paid course requires enrollment in that course; a standalone
  // workshop (courseId null) is open to any authenticated student.
  async join(userId: string, liveClassId: string) {
    const liveClass = await this.findOrThrow(liveClassId);

    if (liveClass.status !== 'LIVE') {
      throw new BadRequestException(
        liveClass.status === 'SCHEDULED'
          ? 'this class has not started yet'
          : `this class is ${liveClass.status.toLowerCase()}`,
      );
    }

    if (liveClass.courseId) {
      const allowed = await this.entitlement.canAccessCourse(userId, liveClass.courseId);
      if (!allowed) throw new ForbiddenException('not enrolled in the related course');
    }

    const joinUrl = this.provider.generateJoinUrl(liveClassId, userId, 'participant');

    await this.prisma.liveClassParticipant.upsert({
      where: { liveClassId_userId: { liveClassId, userId } },
      update: { joinedAt: new Date() },
      create: { liveClassId, userId, joinedAt: new Date() },
    });

    return { joinUrl };
  }

  private async findOrThrow(id: string) {
    const liveClass = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!liveClass) throw new NotFoundException('live class not found');
    return liveClass;
  }
}
