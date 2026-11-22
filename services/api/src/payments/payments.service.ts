import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayProvider,
    private notifications: NotificationsService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course || course.deletedAt || course.status !== 'PUBLISHED') {
      throw new NotFoundException('course not found');
    }
    if (course.accessType !== 'PAID') {
      throw new BadRequestException('this course is free — use enroll-free instead');
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: dto.courseId } },
    });
    if (existingEnrollment) throw new ConflictException('already enrolled in this course');

    let amount = Number(course.discountPrice ?? course.price);
    let couponId: string | undefined;

    if (dto.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.couponCode } });
      if (!coupon) throw new BadRequestException('invalid coupon code');
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BadRequestException('coupon has expired');
      }
      if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
        throw new BadRequestException('coupon redemption limit reached');
      }
      if (coupon.percentOff) amount = amount * (1 - coupon.percentOff / 100);
      if (coupon.amountOff) amount = Math.max(0, amount - Number(coupon.amountOff));
      couponId = coupon.id;
    }

    amount = Math.round(amount * 100) / 100;

    // Order + item created up front in PENDING state; the provider order and
    // Payment record follow. This means an order row always exists before
    // money moves, so reconciliation never has to guess what a stray
    // provider payment was for.
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: amount,
        currency: 'INR',
        couponId,
        items: { create: [{ courseId: course.id, price: amount }] },
      },
    });

    const providerOrder = await this.razorpay.createOrder(
      Math.round(amount * 100), // paise
      'INR',
      order.id,
    );

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'razorpay',
        providerOrderId: providerOrder.providerOrderId,
        amount,
        currency: 'INR',
        status: 'CREATED',
      },
    });

    return { orderId: order.id, checkout: providerOrder.checkoutPayload };
  }

  // Section 34 of the brief: "Account screen: ... Order/payment history."
  // Scoped strictly to the caller's own orders — the WHERE clause on
  // userId is the actual security boundary, not just a UX nicety (see
  // test/e2e/app.e2e-spec.ts's IDOR-style checks for the pattern this
  // follows).
  async listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { course: { select: { title: true, thumbnailUrl: true } } } },
        payments: { select: { provider: true, status: true, amount: true, createdAt: true } },
      },
    });
  }

  // Called only from the webhook endpoint after signature verification —
  // never from a client-reported "payment succeeded" call. This is the one
  // place enrollment gets created for a paid course.
  async handleVerifiedPayment(params: {
    providerOrderId: string;
    providerPaymentId: string;
    amount: number; // paise, as reported by the provider
    status: 'SUCCESS' | 'FAILED';
  }) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: params.providerOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      // Unknown order — log and ignore rather than throw, so Razorpay
      // doesn't retry forever on an event that will never match.
      return { handled: false, reason: 'unknown providerOrderId' };
    }

    // Idempotency: a webhook can be delivered more than once. If we've
    // already recorded success for this exact payment, do nothing further.
    if (payment.status === 'SUCCESS') {
      return { handled: true, alreadyProcessed: true };
    }

    const expectedPaise = Math.round(Number(payment.amount) * 100);
    if (params.status === 'SUCCESS' && params.amount !== expectedPaise) {
      // Amount mismatch is a signal of tampering or a provider-side bug —
      // never grant access, always investigate.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', providerPaymentId: params.providerPaymentId },
      });
      return { handled: true, error: 'amount mismatch' };
    }

    if (params.status === 'FAILED') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', providerPaymentId: params.providerPaymentId },
        }),
        this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'FAILED' } }),
      ]);
      return { handled: true, status: 'FAILED' };
    }

    // Success path: mark payment+order paid, create enrollment(s), bump
    // coupon redemption — all in one transaction so a crash mid-way never
    // leaves a paid order without course access.
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', providerPaymentId: params.providerPaymentId },
      });
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });

      for (const item of payment.order.items) {
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: payment.order.userId, courseId: item.courseId } },
          update: {},
          create: { userId: payment.order.userId, courseId: item.courseId, source: 'PURCHASE' },
        });
      }

      if (payment.order.couponId) {
        await tx.coupon.update({
          where: { id: payment.order.couponId },
          data: { redemptionCount: { increment: 1 } },
        });
      }
    });

    // Best-effort in-app + push confirmation. notify() never throws in a
    // way that could roll back the transaction above — it already
    // succeeded and the payment is real regardless of whether this
    // notification lands.
    const firstItem = payment.order.items[0];
    await this.notifications.notify(
      payment.order.userId,
      'PAYMENT_UPDATE',
      'Payment successful',
      `Your enrollment is confirmed. You now have access to your course${payment.order.items.length > 1 ? 's' : ''}.`,
      firstItem ? `rajarani://course/${firstItem.courseId}` : undefined,
    );

    // TODO(external-credential): also send a receipt email here once the
    // email provider (RESEND/SES) account is configured — deferred for the
    // same reason as the OTP SMS stub in auth.service.ts.

    return { handled: true, status: 'SUCCESS' };
  }

  // Admin-initiated refund (Section 41: Payment Admin — "refunds/status
  // where supported"). Only refunds a payment that actually succeeded —
  // refunding a CREATED/FAILED payment would either fail at Razorpay or
  // refund money that was never charged.
  async refundOrder(orderId: string, revokeAccess = true) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true, items: true },
    });
    if (!order) throw new NotFoundException('order not found');

    const successfulPayment = order.payments.find((p) => p.status === 'SUCCESS');
    if (!successfulPayment || !successfulPayment.providerPaymentId) {
      throw new BadRequestException('no successful payment on this order to refund');
    }
    if (order.status === 'REFUNDED') {
      throw new BadRequestException('order already refunded');
    }

    const refund = await this.razorpay.refundPayment(successfulPayment.providerPaymentId);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: successfulPayment.id },
        data: { status: 'REFUNDED' },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });

      if (revokeAccess) {
        // Revoking access on refund is the sensible default for a
        // marketplace refund, but genuinely is a business-policy choice
        // (some platforms let a refunded student keep access as
        // goodwill) — hence the parameter rather than baking in one
        // answer.
        for (const item of order.items) {
          await tx.enrollment.deleteMany({ where: { userId: order.userId, courseId: item.courseId } });
        }
      }
    });

    await this.notifications.notify(
      order.userId,
      'PAYMENT_UPDATE',
      'Refund processed',
      'Your payment has been refunded.',
    );

    return { refundId: refund.refundId, status: refund.status };
  }
}
