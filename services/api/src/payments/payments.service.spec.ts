import { PaymentsService } from './payments.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

type PrismaMock = {
  course: {
    findUnique: jest.Mock;
  };
  enrollment: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  coupon: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  order: {
    create: jest.Mock;
    update: jest.Mock;
  };
  payment: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    course: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn(), upsert: jest.fn() },
    coupon: { findUnique: jest.fn(), update: jest.fn() },
    order: { create: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(
    (cb: (tx: PrismaMock) => unknown) => cb(mock),
  );

  return mock;
}

function makeRazorpayMock() {
  return {
    createOrder: jest.fn().mockResolvedValue({
      providerOrderId: 'order_test123',
      checkoutPayload: { key: 'rzp_test', order_id: 'order_test123' },
    }),
  };
}

function makeNotificationsMock() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('PaymentsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let razorpay: ReturnType<typeof makeRazorpayMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: PaymentsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    razorpay = makeRazorpayMock();
    notifications = makeNotificationsMock();
    service = new PaymentsService(prisma as any, razorpay as any, notifications as any);
  });

  describe('createOrder', () => {
    it('rejects checkout for a FREE course (should use enroll-free instead)', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'FREE',
        price: null,
      });
      await expect(service.createOrder('user-1', { courseId: 'course-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects checkout if already enrolled (prevents double-charging)', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
        price: 999,
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'existing-enrollment' });
      await expect(service.createOrder('user-1', { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects an expired coupon', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
        price: 999,
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'coupon-1',
        expiresAt: new Date(Date.now() - 1000),
        maxRedemptions: null,
        redemptionCount: 0,
      });
      await expect(
        service.createOrder('user-1', { courseId: 'course-1', couponCode: 'EXPIRED10' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a coupon that has hit its redemption limit', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
        price: 999,
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'coupon-1',
        expiresAt: null,
        maxRedemptions: 10,
        redemptionCount: 10,
      });
      await expect(
        service.createOrder('user-1', { courseId: 'course-1', couponCode: 'MAXEDOUT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes the discounted amount correctly and never trusts a client-supplied amount', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
        price: 1000,
        discountPrice: null,
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'coupon-1',
        expiresAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        percentOff: 20,
        amountOff: null,
      });
      prisma.order.create.mockResolvedValue({ id: 'order-1' });
      prisma.payment.create.mockResolvedValue({});

      await service.createOrder('user-1', { courseId: 'course-1', couponCode: 'SAVE20' });

      // 1000 - 20% = 800 — asserted against Razorpay's order-creation call,
      // which is where a client-supplied amount would have leaked through
      // if this logic trusted anything but the server-side course price.
      expect(razorpay.createOrder).toHaveBeenCalledWith(80_000, 'INR', 'order-1'); // paise
    });

    it('rejects an unknown coupon code', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'course-1',
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
        price: 999,
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(
        service.createOrder('user-1', { courseId: 'course-1', couponCode: 'FAKE' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleVerifiedPayment (webhook)', () => {
    it('ignores a webhook for an order it has no record of, rather than throwing', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      const result = await service.handleVerifiedPayment({
        providerOrderId: 'order_unknown',
        providerPaymentId: 'pay_1',
        amount: 10000,
        status: 'SUCCESS',
      });
      expect(result.handled).toBe(false);
    });

    it('is idempotent — a redelivered webhook for an already-SUCCESS payment is a no-op', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        status: 'SUCCESS',
        amount: 999,
        orderId: 'order-1',
        order: { userId: 'user-1', couponId: null, items: [{ courseId: 'course-1' }] },
      });
      const result = await service.handleVerifiedPayment({
        providerOrderId: 'order_test123',
        providerPaymentId: 'pay_1',
        amount: 99900,
        status: 'SUCCESS',
      });
      expect(result.alreadyProcessed).toBe(true);
      expect(prisma.enrollment.upsert).not.toHaveBeenCalled(); // no double-enrollment
    });

    it('rejects and marks FAILED on an amount mismatch, never granting access', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        status: 'CREATED',
        amount: 999, // rupees — expects 99900 paise
        orderId: 'order-1',
        order: { userId: 'user-1', couponId: null, items: [{ courseId: 'course-1' }] },
      });
      const result = await service.handleVerifiedPayment({
        providerOrderId: 'order_test123',
        providerPaymentId: 'pay_1',
        amount: 50000, // tampered/wrong amount
        status: 'SUCCESS',
      });
      expect(result.error).toBe('amount mismatch');
      expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
    });
  });
});
