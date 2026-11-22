import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../auth/data/current_user_provider.dart';
import '../../../../core/theme/app_theme.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          userAsync.when(
            data: (user) => Card(
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: AppColors.primaryLight,
                      child: Text(
                        user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          if (user.email != null)
                            Text(user.email!, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            loading: () => const SizedBox(height: 72, child: Center(child: CircularProgressIndicator())),
            error: (_, __) => const SizedBox.shrink(), // non-critical — the menu below still works
          ),
          const _MenuTile(icon: Icons.school_outlined, label: 'My Courses', route: '/library'),
          _MenuTile(icon: Icons.workspace_premium_outlined, label: 'Certificates', route: '/certificates'),
          const _MenuTile(icon: Icons.video_camera_front_outlined, label: 'Live Classes', route: '/live-classes'),
          const _MenuTile(icon: Icons.receipt_long_outlined, label: 'Order History', route: '/orders'),
          const _MenuTile(icon: Icons.notifications_none, label: 'Notifications', route: '/notifications-list'),
          const _MenuTile(icon: Icons.settings_outlined, label: 'Settings'),
          const _MenuTile(icon: Icons.help_outline, label: 'Help & Support', route: '/support'),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: () => ref.read(authStateProvider.notifier).logout(),
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: const Text('Log out', style: TextStyle(color: AppColors.error)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.icon, required this.label, this.route});
  final IconData icon;
  final String label;
  final String? route;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
        onTap: route != null ? () => context.push(route!) : null,
      ),
    );
  }
}
