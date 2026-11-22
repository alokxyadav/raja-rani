import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth_controller.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/network/settings_repository.dart';
import '../../../../core/network/maintenance_state.dart';
import '../../../../core/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkMaintenance();
  }

  // Best-effort: if this call fails (offline, backend down), we assume
  // NOT in maintenance rather than blocking the whole app on a settings
  // fetch that itself might be the thing that's down. Auth restoration
  // (via authStateProvider, watched in build()) proceeds independently
  // either way — this never blocks normal startup.
  Future<void> _checkMaintenance() async {
    try {
      final repo = SettingsRepository(ref.read(apiClientProvider));
      final settings = await repo.getSettings();
      if (mounted) ref.read(maintenanceModeProvider.notifier).state = settings.maintenanceMode;
    } catch (_) {
      // Settings endpoint unreachable — proceed as normal, not blocked.
    }
  }

  @override
  Widget build(BuildContext context) {
    // GoRouter's redirect (app_router.dart) reacts to both authStateProvider
    // and maintenanceModeProvider — this screen just renders something
    // branded while those resolve.
    ref.watch(authStateProvider);

    return const Scaffold(
      backgroundColor: AppColors.primary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.school_rounded, size: 64, color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Raja Rani',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 24),
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(color: Colors.white70, strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}
