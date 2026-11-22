import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/auth/presentation/screens/otp_login_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/courses/presentation/screens/course_detail_screen.dart';
import '../../features/library/presentation/screens/library_screen.dart';
import '../../features/account/presentation/screens/account_screen.dart';
import '../../features/community/presentation/screens/community_screen.dart';
import '../../features/onboarding/presentation/screens/onboarding_screen.dart';
import '../../features/certificates/presentation/screens/certificates_screen.dart';
import '../../features/orders/presentation/screens/order_history_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/support/presentation/screens/support_screen.dart';
import '../../features/live_classes/presentation/screens/live_classes_screen.dart';
import '../../features/search/presentation/screens/search_screen.dart';
import '../../features/video/presentation/screens/lesson_player_screen.dart';
import '../network/maintenance_state.dart';
import 'maintenance_screen.dart';
import 'app_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final maintenanceMode = ref.watch(maintenanceModeProvider);

  return GoRouter(
    initialLocation: '/splash',
    // Runs on every navigation. This is the ONE place session-based
    // access control lives for the mobile UI — it does not replace the
    // backend's own auth checks (a screen redirect is a UX nicety, not a
    // security boundary; the API still enforces everything for real).
    redirect: (context, state) {
      final isMaintenanceRoute = state.matchedLocation == '/maintenance';
      if (maintenanceMode && !isMaintenanceRoute) return '/maintenance';
      if (!maintenanceMode && isMaintenanceRoute) return '/splash'; // maintenance lifted mid-session

      final loggedIn = authState.status == AuthStatus.authenticated;
      final isAuthRoute = ['/login', '/register', '/otp-login'].contains(state.matchedLocation);
      final isSplash = state.matchedLocation == '/splash';

      if (authState.status == AuthStatus.unknown) {
        return isSplash ? null : '/splash';
      }
      if (!loggedIn && !isAuthRoute) return '/login';
      if (loggedIn && (isAuthRoute || isSplash)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/maintenance', builder: (context, state) => const MaintenanceScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/otp-login', builder: (context, state) => const OtpLoginScreen()),
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingScreen()),
      GoRoute(
        path: '/course/:slug',
        builder: (context, state) => CourseDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/lesson/:id',
        builder: (context, state) => LessonPlayerScreen(
          lessonId: state.pathParameters['id']!,
          lessonTitle: (state.extra as String?) ?? 'Lesson',
        ),
      ),
      GoRoute(path: '/certificates', builder: (context, state) => const CertificatesScreen()),
      GoRoute(path: '/orders', builder: (context, state) => const OrderHistoryScreen()),
      GoRoute(path: '/notifications-list', builder: (context, state) => const NotificationsScreen()),
      GoRoute(path: '/support', builder: (context, state) => const SupportScreen()),
      GoRoute(path: '/live-classes', builder: (context, state) => const LiveClassesScreen()),
      GoRoute(path: '/search', builder: (context, state) => const SearchScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/library', builder: (context, state) => const LibraryScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/community', builder: (context, state) => const CommunityScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/account', builder: (context, state) => const AccountScreen()),
          ]),
        ],
      ),
    ],
  );
});
