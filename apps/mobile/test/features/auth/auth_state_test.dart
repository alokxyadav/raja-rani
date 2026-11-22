import 'package:flutter_test/flutter_test.dart';
import 'package:raja_rani/features/auth/presentation/auth_controller.dart';

void main() {
  group('AuthState', () {
    test('defaults to AuthStatus.unknown with no error', () {
      const state = AuthState();
      expect(state.status, AuthStatus.unknown);
      expect(state.error, isNull);
    });

    test('copyWith updates only the given field, preserving the rest', () {
      const original = AuthState(status: AuthStatus.authenticated, error: null);
      final updated = original.copyWith(error: 'Session expired');

      // status carries over even though only error was passed — this is
      // the exact bug class copyWith exists to prevent (accidentally
      // resetting status to null/default when only touching one field).
      expect(updated.status, AuthStatus.authenticated);
      expect(updated.error, 'Session expired');
    });

    test('copyWith with no arguments returns an equivalent state', () {
      const original = AuthState(status: AuthStatus.unauthenticated, error: 'x');
      final copy = original.copyWith();
      expect(copy.status, original.status);
      expect(copy.error, original.error);
    });
  });
}
