/// Passed at build time: flutter run --dart-define=API_BASE_URL=https://api.rajarani.app
/// Defaults to the local dev API from docs/SETUP_GUIDE.md so `flutter run`
/// works out of the box against a locally running backend.
class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000', // Android emulator's alias for host localhost
  );
}
