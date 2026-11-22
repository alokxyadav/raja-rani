import '../../../core/network/api_client.dart';

class OrdersRepository {
  OrdersRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> getMyOrders() async {
    final res = await _apiClient.dio.get('/api/v1/orders/mine');
    return (res.data as List).cast<Map<String, dynamic>>();
  }
}
