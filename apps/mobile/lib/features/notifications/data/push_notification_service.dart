import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/providers.dart';

class PushNotificationService {
  PushNotificationService(this._apiClient);
  final ApiClient _apiClient;

  /// Call once after login (see auth_controller.dart's onSessionEstablished
  /// hook point, wired below). Safe to call even if Firebase.initializeApp()
  /// hasn't run yet — it just throws and the caller swallows that, since
  /// push is a nice-to-have, not a login blocker. See main.dart for why
  /// Firebase init itself is still commented out (needs a real project).
  Future<void> registerDevice() async {
    final settings = await FirebaseMessaging.instance.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;

    await _apiClient.dio.post('/api/v1/notifications/devices', data: {
      'token': token,
      'platform': 'android',
    });

    // Tokens rotate periodically — re-register whenever that happens so the
    // backend never pushes to a stale token.
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      _apiClient.dio.post('/api/v1/notifications/devices', data: {
        'token': newToken,
        'platform': 'android',
      });
    });
  }
}

final pushNotificationServiceProvider = Provider((ref) {
  return PushNotificationService(ref.watch(apiClientProvider));
});
