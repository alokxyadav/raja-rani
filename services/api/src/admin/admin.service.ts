import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import { SearchUsersDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async listUsers(query: SearchUsersDto) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query.role ? { role: query.role as any } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { email: { contains: query.search, mode: 'insensitive' as const } },
                { phone: { contains: query.search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('user not found');

    const [enrollments, orders, certificates] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { title: true } } },
      }),
      this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.certificate.findMany({ where: { userId }, include: { course: { select: { title: true } } } }),
    ]);

    return { user, enrollments, orders, certificates };
  }

  async suspendUser(actorId: string, userId: string) {
    const user = await this.findOrThrow(userId);
    if (user.role === 'ADMIN') {
      throw new BadRequestException('cannot suspend an admin account through this endpoint');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    await this.auditLog.log(actorId, 'user.suspend', 'User', userId, {
      from: user.status,
      to: 'SUSPENDED',
    });
    return updated;
  }

  async reactivateUser(actorId: string, userId: string) {
    const user = await this.findOrThrow(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    await this.auditLog.log(actorId, 'user.reactivate', 'User', userId, {
      from: user.status,
      to: 'ACTIVE',
    });
    return updated;
  }

  // Every number below is a live COUNT/aggregate — never a stored or
  // hard-coded dashboard figure, per the brief's explicit requirement.
  async getDashboardMetrics() {
    const [
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      revenueAgg,
      refundedAgg,
      certificatesIssued,
      upcomingLiveClasses,
      communityPosts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      this.prisma.enrollment.count(),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: 'REFUNDED' }, _sum: { amount: true } }),
      this.prisma.certificate.count(),
      this.prisma.liveClass.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }),
      this.prisma.communityPost.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalRevenue: revenueAgg._sum.amount ?? 0,
      totalRefunded: refundedAgg._sum.amount ?? 0,
      certificatesIssued,
      upcomingLiveClasses,
      communityPosts,
    };
  }

  // ---------- Orders / Payments (Section 41: Payment Admin) ----------

  async listOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        items: { include: { course: { select: { title: true } } } },
        payments: { select: { provider: true, providerPaymentId: true, status: true, amount: true } },
      },
    });
  }

  // ---------- Certificates (admin view — distinct from a student's own
  // certificates.mine, which is scoped to that student only) ----------

  async listCertificates() {
    return this.prisma.certificate.findMany({
      orderBy: { issuedAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    });
  }

  // ---------- Audit logs (Section 57) ----------

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Resolve actor names in one batch query rather than N+1 — audit logs
    // only store actorId (a stable reference), never a denormalized name
    // that could go stale if the admin later renames their account.
    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a.name]));
    return logs.map((log) => ({ ...log, actorName: actorMap.get(log.actorId) ?? 'Unknown' }));
  }

  private async findOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('user not found');
    return user;
  }
}
