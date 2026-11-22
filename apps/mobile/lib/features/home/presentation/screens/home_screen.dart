import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../courses/data/courses_providers.dart';
import '../../../courses/presentation/widgets/course_card.dart';
import '../../../../core/theme/app_theme.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courses = ref.watch(courseListProvider);
    final banners = ref.watch(activeBannersProvider);
    final library = ref.watch(libraryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Raja Rani'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () => context.push('/search')),
          IconButton(icon: const Icon(Icons.notifications_none), onPressed: () => context.push('/notifications-list')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(courseListProvider);
          ref.invalidate(activeBannersProvider);
          ref.invalidate(libraryProvider);
        },
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          children: [
            // ---- Featured banner ----
            banners.when(
              data: (items) => items.isEmpty
                  ? const SizedBox.shrink()
                  : _BannerCarousel(banners: items),
              loading: () => const SizedBox(height: 160),
              error: (_, __) => const SizedBox.shrink(), // non-critical — fail silently
            ),

            // ---- Continue learning ----
            library.when(
              data: (items) {
                final ongoing = items.where((e) => e['status'] == 'ONGOING').toList();
                if (ongoing.isEmpty) return const SizedBox.shrink();
                return _Section(
                  title: 'Continue Learning',
                  child: SizedBox(
                    height: 160,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      itemCount: ongoing.length,
                      separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                      itemBuilder: (context, i) {
                        final item = ongoing[i];
                        return _ContinueLearningCard(item: item);
                      },
                    ),
                  ),
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // ---- Discover courses ----
            _Section(
              title: 'Popular Courses',
              child: courses.when(
                data: (items) => items.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(AppSpacing.lg),
                        child: Text('No courses published yet.', style: TextStyle(color: AppColors.textMuted)),
                      )
                    : SizedBox(
                        height: 220,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (context, i) => CourseCard(
                            course: items[i],
                            onTap: () => context.push('/course/${items[i].slug}'),
                          ),
                        ),
                      ),
                loading: () => const SizedBox(
                  height: 220,
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    children: [
                      const Text('Could not load courses.', style: TextStyle(color: AppColors.error)),
                      TextButton(
                        onPressed: () => ref.invalidate(courseListProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, AppSpacing.sm),
          child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
        child,
      ],
    );
  }
}

class _BannerCarousel extends StatelessWidget {
  const _BannerCarousel({required this.banners});
  final List<Map<String, dynamic>> banners;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        itemCount: banners.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, i) {
          final banner = banners[i];
          return ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.card),
            child: Image.network(
              banner['imageUrl'],
              width: 320,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(width: 320, color: AppColors.primaryLight),
            ),
          );
        },
      ),
    );
  }
}

class _ContinueLearningCard extends StatelessWidget {
  const _ContinueLearningCard({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final progressPct = (item['progressPct'] as num?)?.toInt() ?? 0;
    return InkWell(
      onTap: () => context.push('/course/${item['slug']}'),
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item['title'], maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const Spacer(),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: progressPct / 100, minHeight: 6),
            ),
            const SizedBox(height: 4),
            Text('$progressPct% complete', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
