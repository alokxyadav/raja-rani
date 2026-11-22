import 'api_client.dart';

class PlatformSettings {
  PlatformSettings({required this.maintenanceMode, required this.forceUpdate, required this.latestVersion});
  final bool maintenanceMode;
  final bool forceUpdate;
  final String latestVersion;

  factory PlatformSettings.fromJson(Map<String, dynamic> json) => PlatformSettings(
        maintenanceMode: json['MAINTENANCE_MODE'] == 'true',
        forceUpdate: json['FORCE_UPDATE'] == 'true',
        latestVersion: json['LATEST_APP_VERSION'] ?? '1.0.0',
      );
}

class SettingsRepository {
  SettingsRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<PlatformSettings> getSettings() async {
    final res = await _apiClient.dio.get('/api/v1/settings');
    return PlatformSettings.fromJson(res.data as Map<String, dynamic>);
  }
}
