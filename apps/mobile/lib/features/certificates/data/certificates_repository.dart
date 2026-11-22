import '../../../core/network/api_client.dart';

class CertificatesRepository {
  CertificatesRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> getMine() async {
    final res = await _apiClient.dio.get('/api/v1/certificates/mine');
    return (res.data as List).cast<Map<String, dynamic>>();
  }
}
