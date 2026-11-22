import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/community_repository.dart';
import '../../../auth/data/current_user_provider.dart';
import '../../../reports/presentation/report_dialog.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final communityRepositoryProvider = Provider((ref) => CommunityRepository(ref.watch(apiClientProvider)));

final communityFeedProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(communityRepositoryProvider).getFeed();
});

class CommunityScreen extends ConsumerWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(communityFeedProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Community')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(communityFeedProvider),
        child: feedAsync.when(
          data: (posts) => posts.isEmpty
              ? const Center(child: Text('No posts yet. Be the first!', style: TextStyle(color: AppColors.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: posts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _PostCard(post: posts[i]),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load the feed.', style: TextStyle(color: AppColors.error)),
                TextButton(onPressed: () => ref.invalidate(communityFeedProvider), child: const Text('Retry')),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showComposeSheet(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showComposeSheet(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showModalBottomSheet(
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
            TextField(
              controller: controller,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(hintText: "What's on your mind?"),
            ),
            const SizedBox(height: AppSpacing.sm),
            ElevatedButton(
              onPressed: () async {
                if (controller.text.trim().isEmpty) return;
                await ref.read(communityRepositoryProvider).createPost(controller.text.trim());
                ref.invalidate(communityFeedProvider);
                if (context.mounted) Navigator.of(context).pop();
              },
              child: const Text('Post'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PostCard extends ConsumerWidget {
  const _PostCard({required this.post});
  final Map<String, dynamic> post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = post['user'] as Map<String, dynamic>?;
    final isAnnouncement = post['isAnnouncement'] == true;
    final commentCount = post['_count']?['comments'] ?? 0;
    final currentUser = ref.watch(currentUserProvider).valueOrNull;
    // Delete only shown when the post is actually the caller's own — the
    // real enforcement is server-side (community.service.ts's
    // deleteOwnPost throws ForbiddenException on a mismatch), this is
    // just the UI not offering a button that would fail anyway.
    final isOwnPost = currentUser != null && currentUser.id == post['userId'];

    return Card(
      color: isAnnouncement ? AppColors.primary.withValues(alpha: 0.06) : AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(radius: 16, backgroundColor: AppColors.primaryLight, child: Text((user?['name'] ?? '?')[0])),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?['name'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (isAnnouncement)
                        const Text('Announcement', style: TextStyle(fontSize: 11, color: AppColors.primary)),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, size: 18, color: AppColors.textMuted),
                  onSelected: (value) async {
                    if (value == 'delete') {
                      await ref.read(communityRepositoryProvider).deletePost(post['id']);
                      ref.invalidate(communityFeedProvider);
                    } else if (value == 'report') {
                      await showReportDialog(context, ref, resourceType: 'COMMUNITY_POST', resourceId: post['id']);
                    }
                  },
                  itemBuilder: (context) => [
                    if (isOwnPost) const PopupMenuItem(value: 'delete', child: Text('Delete post')),
                    if (!isOwnPost) const PopupMenuItem(value: 'report', child: Text('Report post')),
                  ],
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(post['body'] ?? ''),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                const Icon(Icons.mode_comment_outlined, size: 16, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text('$commentCount', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
