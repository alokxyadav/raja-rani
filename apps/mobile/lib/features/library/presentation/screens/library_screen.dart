import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../courses/data/courses_providers.dart';
import '../../../../core/theme/app_theme.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final libraryAsync = ref.watch(libraryProvider);

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My Library'),
          bottom: const TabBar(
            tabs: [Tab(text: 'All'), Tab(text: 'Ongoing'), Tab(text: 'Completed')],
          ),
        ),
        body: libraryAsync.when(
          data: (items) {
            if (items.isEmpty) {
              return const _EmptyLibrary();
            }
            final ongoing = items.where((e) => e['status'] == 'ONGOING').toList();
            final completed = items.where((e) => e['status'] == 'COMPLETED').toList();
            return TabBarView(
              children: [
                _CourseList(items: items),
                _CourseList(items: ongoing),
                _CourseList(items: completed),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load your library.', style: TextStyle(color: AppColors.error)),
                TextButton(onPressed: () => ref.invalidate(libraryProvider), child: const Text('Retry')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.menu_book_outlined, size: 56, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.md),
            const Text('No courses yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Enroll in a free course or purchase one to see it here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted),
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton(onPressed: () => context.go('/home'), child: const Text('Browse courses')),
          ],
        ),
      ),
    );
  }
}

class _CourseList extends StatelessWidget {
  const _CourseList({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(child: Text('Nothing here yet.', style: TextStyle(color: AppColors.textMuted)));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, i) {
        final item = items[i];
        final progressPct = (item['progressPct'] as num?)?.toInt() ?? 0;
        return Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(AppSpacing.sm),
            title: Text(item['title'], style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(value: progressPct / 100, minHeight: 6),
              ),
            ),
            trailing: Text('$progressPct%'),
            onTap: () => context.push('/course/${item['slug']}'),
          ),
        );
      },
    );
  }
}
