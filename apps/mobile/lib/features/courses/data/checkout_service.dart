import 'dart:async';
import 'package:razorpay_flutter/razorpay_flutter.dart';

/// The SDK's onPaymentSuccess callback is a UX signal, NOT proof of
/// payment — per the brief's "never trust client-side success callbacks."
/// This screen's job ends at "the checkout sheet closed with a success
/// callback"; actual enrollment only happens once the backend's webhook
/// (payments.service.ts, Phase 4) verifies the payment server-side. That
/// means after a successful checkout here, the UI should poll or re-fetch
/// the library rather than assume access is granted immediately.
class CheckoutService {
  CheckoutService() {
    _razorpay = Razorpay();
  }

  late final Razorpay _razorpay;

  void open({
    required String keyId,
    required String orderId,
    required int amountInPaise,
    required String currency,
    required void Function() onSuccess,
    required void Function(String message) onError,
  }) {
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse response) {
      onSuccess();
    });
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse response) {
      onError(response.message ?? 'Payment failed or was cancelled.');
    });
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse response) {
      onError('External wallet selected — not yet handled: ${response.walletName}');
    });

    _razorpay.open({
      'key': keyId,
      'order_id': orderId,
      'amount': amountInPaise,
      'currency': currency,
      'name': 'Raja Rani',
      'description': 'Course purchase',
    });
  }

  void dispose() => _razorpay.clear();
}
