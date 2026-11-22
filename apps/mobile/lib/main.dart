import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() {
  // Firebase.initializeApp() goes here once FlutterFire is configured for
  // this project (needs a real Firebase project — see docs/NOTIFICATIONS.md
  // on the backend side for the matching FCM setup). Deliberately omitted
  // rather than faked; push registration in notifications_repository.dart
  // (next phase) will no-op safely until this is wired up.
  runApp(const ProviderScope(child: RajaRaniApp()));
}

class RajaRaniApp extends ConsumerWidget {
  const RajaRaniApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Raja Rani',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: router,
    );
  }
}
