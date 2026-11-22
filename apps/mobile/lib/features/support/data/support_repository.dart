import '../../../core/network/api_client.dart';

class SupportRepository {
  SupportRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> getMyTickets() async {
    final res = await _apiClient.dio.get('/api/v1/support/tickets/mine');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> createTicket({required String category, required String subject, required String message}) async {
    await _apiClient.dio.post('/api/v1/support/tickets', data: {
      'category': category,
      'subject': subject,
      'message': message,
    });
  }
}
