import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final notificationsListProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.watch(apiClientProvider).dio.get('/api/v1/notifications');
  return (res.data as List).cast<Map<String, dynamic>>();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsListProvider),
        child: notificationsAsync.when(
          data: (items) => items.isEmpty
              ? const Center(
                  child: Text('No notifications yet.', style: TextStyle(color: AppColors.textMuted)),
                )
              : ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) => _NotificationTile(notification: items[i], ref: ref),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load notifications.', style: TextStyle(color: AppColors.error)),
                TextButton(onPressed: () => ref.invalidate(notificationsListProvider), child: const Text('Retry')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.ref});
  final Map<String, dynamic> notification;
  final WidgetRef ref;

  bool get _isUnread => notification['readAt'] == null;

  Future<void> _markRead() async {
    if (!_isUnread) return;
    await ref.read(apiClientProvider).dio.post('/api/v1/notifications/${notification['id']}/read');
    ref.invalidate(notificationsListProvider);
    // No navigation to notification['deepLink'] here — mapping deep links
    // like "rajarani://course/{id}" to an actual GoRouter push is a small,
    // separate addition once every deep-link target has a stable route
    // name; marking read is the part this screen owns today.
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: _markRead,
      tileColor: _isUnread ? AppColors.primary.withValues(alpha: 0.04) : null,
      leading: Icon(
        _isUnread ? Icons.circle : Icons.circle_outlined,
        size: 10,
        color: _isUnread ? AppColors.primary : AppColors.textMuted,
      ),
      title: Text(
        notification['title'] ?? '',
        style: TextStyle(fontWeight: _isUnread ? FontWeight.w600 : FontWeight.normal),
      ),
      subtitle: Text(notification['body'] ?? ''),
    );
  }
}
