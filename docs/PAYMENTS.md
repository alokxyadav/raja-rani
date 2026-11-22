# Payments

## Flow (implemented)

```
Client → POST /api/v1/orders {courseId, couponCode?}
       → server validates course, price, coupon (server-side, never trusts client amount)
       → server creates Order (PENDING) + Payment (CREATED) rows
       → server calls Razorpay to create a provider order
       → server returns {orderId, checkout: {key, order_id, amount, currency}}
Client → opens Razorpay Checkout with that payload
       → user pays
Razorpay → POST /api/v1/webhooks/razorpay (signed with RAZORPAY_WEBHOOK_SECRET)
       → server verifies HMAC signature against the raw request body
       → server looks up the Payment by provider order ID
       → if already SUCCESS: no-op (idempotent — webhooks can be redelivered)
       → if amount doesn't match what we quoted: mark FAILED, do not enroll
       → if SUCCESS and amount matches: single transaction —
           mark Payment SUCCESS, Order PAID, create Enrollment(s), bump coupon count
```

The client's checkout success callback is never trusted to grant access —
only the verified webhook does that. This is deliberate and should not be
"simplified" later for convenience.

## Open decision: Google Play Billing

Google Play policy (as of this writing) generally requires apps distributed
through Play to use **Google Play Billing**, not an external payment
gateway, for digital content purchased *inside the app* — with some
India-specific alternative billing programme allowances that come with
their own eligibility and fee terms. Razorpay alone, wired directly into
the Android checkout screen, risks a Play Store policy rejection.

Two realistic paths:

1. **Play Billing for the Android app, Razorpay for the website** (if/when
   a website exists). This is the safer default and is why
   `PaymentProvider` is an interface — a `PlayBillingProvider` can be added
   alongside `RazorpayProvider` without touching `PaymentsService`.
2. Apply for Google's India alternative billing programme, which still
   requires meeting Google's conditions and paying a (reduced) service fee.

**Recommendation:** decide this before building the mobile checkout screen,
not after — the UI and the receipt-verification flow differ meaningfully
between the two. Current code implements Razorpay only; the Play Billing
adapter is not yet built.

## What's NOT implemented yet

- Refunds (schema supports it via `PaymentStatus.REFUNDED`; no endpoint yet)
- Payment reconciliation job (comparing Razorpay dashboard vs our DB)
- Receipt email (needs an email provider account — see PROJECT_STATUS.md)
- Google Play Billing adapter (see decision above)
