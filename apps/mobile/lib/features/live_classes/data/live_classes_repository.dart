import '../../../core/network/api_client.dart';

class LiveClassesRepository {
  LiveClassesRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listUpcoming() async {
    final res = await _apiClient.dio.get('/api/v1/live-classes');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> setReminder(String liveClassId) async {
    await _apiClient.dio.post('/api/v1/live-classes/$liveClassId/reminder');
  }

  Future<String> join(String liveClassId) async {
    final res = await _apiClient.dio.post('/api/v1/live-classes/$liveClassId/join');
    return res.data['joinUrl'] as String;
  }
}
