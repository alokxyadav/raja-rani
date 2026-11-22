import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/courses_providers.dart';
import '../../data/course_models.dart';
import '../../data/checkout_service.dart';
import '../../../reports/presentation/report_dialog.dart';
import '../../../../core/theme/app_theme.dart';

class CourseDetailScreen extends ConsumerWidget {
  const CourseDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(courseDetailProvider(slug));
    final libraryAsync = ref.watch(libraryProvider);

    return Scaffold(
      body: detailAsync.when(
        data: (course) {
          final enrolled = libraryAsync.maybeWhen(
            data: (items) => items.any((e) => e['courseId'] == course.id),
            orElse: () => false,
          );
          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 220,
                pinned: true,
                flexibleSpace: FlexibleSpaceBar(
                  background: course.thumbnailUrl != null
                      ? Image.network(course.thumbnailUrl!, fit: BoxFit.cover)
                      : Container(color: AppColors.primaryLight),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(course.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                      if (course.instructorName != null) ...[
                        const SizedBox(height: 4),
                        Text('by ${course.instructorName}', style: const TextStyle(color: AppColors.textMuted)),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      if (course.shortDescription != null) Text(course.shortDescription!),
                      if (course.learningOutcomes.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.lg),
                        const Text("What you'll learn", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: AppSpacing.sm),
                        ...course.learningOutcomes.map(
                          (o) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.check_circle, size: 18, color: AppColors.success),
                                const SizedBox(width: 8),
                                Expanded(child: Text(o)),
                              ],
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      const Text('Content', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ...course.chapters.map((chapter) => _ChapterTile(chapter: chapter, enrolled: enrolled)),
                      const SizedBox(height: AppSpacing.lg),
                      _ReviewsSection(course: course, isEnrolled: enrolled),
                      const SizedBox(height: 100), // space for the floating CTA
                    ],
                  ),
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load this course.', style: TextStyle(color: AppColors.error)),
              TextButton(
                onPressed: () => ref.invalidate(courseDetailProvider(slug)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: detailAsync.maybeWhen(
        data: (course) => _CtaBar(course: course, isEnrolled: libraryAsync.maybeWhen(
          data: (items) => items.any((e) => e['courseId'] == course.id),
          orElse: () => false,
        )),
        orElse: () => null,
      ),
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.chapter, required this.enrolled});
  final ChapterSummary chapter;
  final bool enrolled;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      title: Text(chapter.title, style: const TextStyle(fontWeight: FontWeight.w600)),
      tilePadding: EdgeInsets.zero,
      children: chapter.lessons
          .map(
            (lesson) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                lesson.contentType == 'VIDEO' ? Icons.play_circle_outline : Icons.description_outlined,
                color: (enrolled || lesson.isFreePreview) ? AppColors.primary : AppColors.textMuted,
              ),
              title: Text(lesson.title),
              trailing: (!enrolled && !lesson.isFreePreview) ? const Icon(Icons.lock_outline, size: 18) : null,
              onTap: (enrolled || lesson.isFreePreview)
                  ? () => context.push('/lesson/${lesson.id}', extra: lesson.title)
                  : null,
            ),
          )
          .toList(),
    );
  }
}

class _CtaBar extends ConsumerStatefulWidget {
  const _CtaBar({required this.course, required this.isEnrolled});
  final CourseDetail course;
  final bool isEnrolled;

  @override
  ConsumerState<_CtaBar> createState() => _CtaBarState();
}

class _CtaBarState extends ConsumerState<_CtaBar> {
  bool _isSubmitting = false;
  bool _waitingForConfirmation = false;
  final _checkout = CheckoutService();
  String? _appliedCouponCode;

  @override
  void dispose() {
    _checkout.dispose();
    super.dispose();
  }

  Future<void> _showCouponSheet() async {
    final controller = TextEditingController(text: _appliedCouponCode ?? '');
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.md,
          bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Have a coupon code?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: controller,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'e.g. WELCOME10'),
            ),
            const SizedBox(height: AppSpacing.sm),
            // The discount itself is never computed client-side — this
            // just passes the code through. createOrder() (Phase 4,
            // payments.service.ts) validates the code server-side and
            // computes the real amount from it; an invalid/expired code
            // surfaces as a real error at that point, not silently here.
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
    if (result != null) {
      setState(() => _appliedCouponCode = result.isEmpty ? null : result);
    }
  }

  Future<void> _handleCta() async {
    setState(() => _isSubmitting = true);
    try {
      if (widget.course.isFree) {
        await ref.read(coursesRepositoryProvider).enrollFree(widget.course.id);
        ref.invalidate(libraryProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Enrolled! Find it in your Library.')),
          );
        }
      } else {
        final order = await ref.read(coursesRepositoryProvider).createOrder(
              widget.course.id,
              couponCode: _appliedCouponCode,
            );
        final checkoutPayload = order['checkout'] as Map<String, dynamic>;
        _checkout.open(
          keyId: checkoutPayload['key'],
          orderId: checkoutPayload['order_id'],
          amountInPaise: checkoutPayload['amount'],
          currency: checkoutPayload['currency'],
          onSuccess: _onCheckoutSuccess,
          onError: _onCheckoutError,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          // A rejected coupon (expired/unknown/limit-reached) comes back
          // as a real error from createOrder() — surfaced here rather
          // than a generic message, since "why didn't my coupon work" is
          // the most likely reason this specific call fails.
          SnackBar(content: Text(_appliedCouponCode != null
              ? 'Could not apply that coupon, or checkout failed. Please check the code and try again.'
              : 'Could not start checkout. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  // The SDK callback firing is NOT proof of payment — see checkout_service.dart.
  // Real enrollment happens server-side once Razorpay's webhook is verified
  // (payments.service.ts). So instead of assuming access, poll the library
  // briefly for the enrollment to actually appear — webhooks are typically
  // near-instant but this is deliberately not instantaneous-guaranteed.
  Future<void> _onCheckoutSuccess() async {
    if (!mounted) return;
    setState(() => _waitingForConfirmation = true);

    for (var attempt = 0; attempt < 6; attempt++) {
      await Future.delayed(const Duration(seconds: 2));
      ref.invalidate(libraryProvider);
      final library = await ref.read(coursesRepositoryProvider).getLibrary();
      if (library.any((e) => e['courseId'] == widget.course.id)) {
        if (mounted) {
          setState(() => _waitingForConfirmation = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payment confirmed! Course unlocked.')),
          );
        }
        return;
      }
    }

    if (mounted) {
      setState(() => _waitingForConfirmation = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Payment received — confirming access. If your course doesn't "
            "appear in a minute, check Order History or contact support.",
          ),
        ),
      );
    }
  }

  void _onCheckoutError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.isEnrolled
        ? 'Continue Learning'
        : (widget.course.isFree ? 'Enroll for Free' : 'Buy Now — ₹${(widget.course.discountPrice ?? widget.course.price)?.toStringAsFixed(0)}');
    final busy = _isSubmitting || _waitingForConfirmation;
    final showCouponLink = !widget.isEnrolled && !widget.course.isFree;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showCouponLink)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: TextButton(
                  onPressed: busy ? null : _showCouponSheet,
                  child: Text(
                    _appliedCouponCode != null ? 'Coupon "$_appliedCouponCode" applied — change' : 'Have a coupon?',
                  ),
                ),
              ),
            ElevatedButton(
              onPressed: (busy || widget.isEnrolled) ? null : _handleCta,
              child: busy
                  ? const SizedBox(
                      width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(label),
            ),
          ],
        ),
      ),
    );
  }
}

final courseReviewsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, courseId) {
  return ref.watch(coursesRepositoryProvider).getReviews(courseId);
});

class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.course, required this.isEnrolled});
  final CourseDetail course;
  final bool isEnrolled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(courseReviewsProvider(course.id));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Reviews', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const Spacer(),
            if (isEnrolled)
              TextButton(
                onPressed: () => _showReviewSheet(context, ref),
                child: const Text('Write a review'),
              ),
          ],
        ),
        reviewsAsync.when(
          data: (data) {
            final items = (data['items'] as List).cast<Map<String, dynamic>>();
            if (items.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Text('No reviews yet.', style: TextStyle(color: AppColors.textMuted)),
              );
            }
            return Column(
              children: items.take(5).map((review) => _ReviewTile(review: review)).toList(),
            );
          },
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => const SizedBox.shrink(), // non-critical section — fail quietly
        ),
      ],
    );
  }

  void _showReviewSheet(BuildContext context, WidgetRef ref) {
    int rating = 5;
    final bodyController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Rate this course', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: AppSpacing.sm),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final starIndex = i + 1;
                  return IconButton(
                    onPressed: () => setSheetState(() => rating = starIndex),
                    icon: Icon(
                      starIndex <= rating ? Icons.star : Icons.star_border,
                      color: AppColors.secondary,
                      size: 32,
                    ),
                  );
                }),
              ),
              TextField(
                controller: bodyController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Share your experience (optional)'),
              ),
              const SizedBox(height: AppSpacing.sm),
              ElevatedButton(
                onPressed: () async {
                  try {
                    await ref
                        .read(coursesRepositoryProvider)
                        .submitReview(course.id, rating, body: bodyController.text.trim());
                    ref.invalidate(courseReviewsProvider(course.id));
                    if (context.mounted) Navigator.of(context).pop();
                  } catch (e) {
                    // Most likely cause: already reviewed this course —
                    // the server enforces one review per user (reviews.service.ts).
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Couldn't submit — you may have already reviewed this course.")),
                      );
                    }
                  }
                },
                child: const Text('Submit review'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReviewTile extends ConsumerWidget {
  const _ReviewTile({required this.review});
  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = review['user'] as Map<String, dynamic>?;
    final rating = review['rating'] as int? ?? 0;
    final verified = review['verifiedEnrollment'] == true;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(user?['name'] ?? 'Student', style: const TextStyle(fontWeight: FontWeight.w600)),
              if (verified) ...[
                const SizedBox(width: 6),
                const Icon(Icons.verified, size: 14, color: AppColors.success),
              ],
              const Spacer(),
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(i < rating ? Icons.star : Icons.star_border, size: 14, color: AppColors.secondary),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.flag_outlined, size: 16, color: AppColors.textMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => showReportDialog(context, ref, resourceType: 'REVIEW', resourceId: review['id']),
              ),
            ],
          ),
          if (review['body'] != null && (review['body'] as String).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(review['body']),
            ),
        ],
      ),
    );
  }
}
