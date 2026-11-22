import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

type RawBodyRequest = Request & { rawBody?: Buffer };
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { PaymentsService } from './payments.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { CreateOrderDto } from './dto/payment.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('api/v1')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private razorpay: RazorpayProvider,
  ) {}

  @Post('orders')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: CurrentUserPayload) {
    return this.payments.createOrder(user.id, dto);
  }

  @Get('orders/mine')
  listMyOrders(@CurrentUser() user: CurrentUserPayload) {
    return this.payments.listMyOrders(user.id);
  }

  @Roles('ADMIN')
  @Post('admin/orders/:id/refund')
  refund(@Param('id') orderId: string) {
    return this.payments.refundOrder(orderId);
  }

  // Public because Razorpay calls this directly, with no user session — the
  // HMAC signature (verified inside the service, against the exact raw
  // bytes below) is what authenticates the request, not a bearer token.
  @Public()
  @Post('webhooks/razorpay')
  async razorpayWebhook(
    @Req() req: RawBodyRequest,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('missing signature header');
    if (!req.rawBody) throw new BadRequestException('missing raw body');

    const result = this.razorpay.verifyWebhookSignature(req.rawBody.toString('utf8'), signature);
    if (!result.valid) throw new BadRequestException('invalid webhook signature');

    return this.payments.handleVerifiedPayment({
      providerOrderId: result.providerOrderId!,
      providerPaymentId: result.providerPaymentId!,
      amount: result.amount!,
      status: result.status!,
    });
  }
}
