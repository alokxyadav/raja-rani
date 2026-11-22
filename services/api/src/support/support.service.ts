import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSupportTicketDto, RespondToTicketDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Deliberately open to any authenticated user with no entitlement check
  // — unlike Reviews, support access isn't gated by enrollment. A student
  // asking about a failed payment on a course they never got access to is
  // exactly the kind of ticket this needs to accept, not reject.
  create(userId: string, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: { userId, category: dto.category, subject: dto.subject, message: dto.message },
    });
  }

  listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: "Admin should see support requests" (Section 75). Not gated by
  // status — an admin needs to see CLOSED tickets too, for history.
  listAllForAdmin(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // OPEN tickets surface first
      include: { user: { select: { name: true, email: true } } },
    });
  }

  async respond(ticketId: string, adminId: string, dto: RespondToTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('ticket not found');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { adminResponse: dto.response, status: dto.status, respondedById: adminId },
    });

    // Best-effort, same pattern as every other notify() call in this
    // codebase — a failed push never rolls back the actual ticket update.
    await this.notifications.notify(
      ticket.userId,
      'SYSTEM',
      'Support ticket updated',
      `Re: "${ticket.subject}" — ${dto.response}`,
    );

    return updated;
  }
}
