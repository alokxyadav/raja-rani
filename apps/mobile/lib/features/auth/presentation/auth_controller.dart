import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/providers.dart';
import '../../notifications/data/push_notification_service.dart';
import '../data/current_user_provider.dart';
import 'auth_repository.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({this.status = AuthStatus.unknown, this.error});
  final AuthStatus status;
  final String? error;

  AuthState copyWith({AuthStatus? status, String? error}) =>
      AuthState(status: status ?? this.status, error: error ?? this.error);
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStorageProvider));
});

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider), ref);
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._repo, this._ref) : super(const AuthState()) {
    _restoreSession();
  }

  final AuthRepository _repo;
  final Ref _ref;

  Future<void> _restoreSession() async {
    final hasSession = await _ref.read(tokenStorageProvider).hasSession();
    state = AuthState(status: hasSession ? AuthStatus.authenticated : AuthStatus.unauthenticated);
  }

  Future<void> login({String? email, String? phone, required String password}) async {
    try {
      await _repo.login(email: email, phone: phone, password: password);
      state = const AuthState(status: AuthStatus.authenticated);
      _registerPushSafely();
    } catch (e) {
      state = AuthState(status: AuthStatus.unauthenticated, error: _friendlyError(e));
      rethrow;
    }
  }

  Future<void> register({
    required String name,
    String? email,
    String? phone,
    required String password,
  }) async {
    try {
      await _repo.register(name: name, email: email, phone: phone, password: password);
      state = const AuthState(status: AuthStatus.authenticated);
      _registerPushSafely();
    } catch (e) {
      state = AuthState(status: AuthStatus.unauthenticated, error: _friendlyError(e));
      rethrow;
    }
  }

  Future<void> verifyOtp({required String phone, required String code}) async {
    try {
      await _repo.verifyOtp(phone: phone, code: code);
      state = const AuthState(status: AuthStatus.authenticated);
      _registerPushSafely();
    } catch (e) {
      state = AuthState(status: AuthStatus.unauthenticated, error: _friendlyError(e));
      rethrow;
    }
  }

  Future<void> loginWithGoogle(String idToken) async {
    try {
      await _repo.loginWithGoogle(idToken);
      state = const AuthState(status: AuthStatus.authenticated);
      _registerPushSafely();
    } catch (e) {
      state = AuthState(status: AuthStatus.unauthenticated, error: _friendlyError(e));
      rethrow;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    // Clears the cached "who am I" fetch — otherwise a second account
    // logging in on the same device would briefly see the previous
    // user's cached name/ownership checks until the provider naturally
    // refreshed.
    _ref.invalidate(currentUserProvider);
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  // Push registration is best-effort and must never block or fail a login/
  // register/OTP flow — a missing Firebase project (see main.dart) or a
  // denied permission just means no push, not a broken login.
  Future<void> _registerPushSafely() async {
    try {
      await _ref.read(pushNotificationServiceProvider).registerDevice();
    } catch (_) {
      // Firebase not initialized yet, or permission denied — fine, ignore.
    }
  }

  String _friendlyError(Object e) {
    // Server error messages (from NestJS's ValidationPipe / exception
    // filters) are already safe, user-readable strings — surface them
    // directly instead of a generic "something went wrong".
    return e.toString().contains('DioException')
        ? 'That didn\'t work — check your details and try again.'
        : e.toString();
  }
}
