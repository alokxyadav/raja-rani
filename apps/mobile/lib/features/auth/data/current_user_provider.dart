import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/providers.dart';

class CurrentUserProfile {
  CurrentUserProfile({required this.id, required this.name, this.email, this.phone, required this.mfaEnabled});
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final bool mfaEnabled;

  factory CurrentUserProfile.fromJson(Map<String, dynamic> json) => CurrentUserProfile(
        id: json['id'],
        name: json['name'],
        email: json['email'],
        phone: json['phone'],
        mfaEnabled: json['mfaEnabled'] ?? false,
      );
}

// autoDispose deliberately omitted — the current user's identity is stable
// for the lifetime of the session, and every screen that needs "is this
// mine" (community post ownership) or a profile display (Account screen)
// benefits from sharing one cached fetch rather than re-requesting on
// every screen visit.
final currentUserProvider = FutureProvider<CurrentUserProfile>((ref) async {
  final res = await ref.watch(apiClientProvider).dio.get('/api/v1/auth/me');
  return CurrentUserProfile.fromJson(res.data as Map<String, dynamic>);
});
