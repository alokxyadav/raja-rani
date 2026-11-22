import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/providers.dart';

class ReportsRepository {
  ReportsRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<void> submitReport({
    required String resourceType, // 'COMMUNITY_POST' | 'COMMUNITY_COMMENT' | 'REVIEW'
    required String resourceId,
    required String reason,
  }) async {
    await _apiClient.dio.post('/api/v1/reports', data: {
      'resourceType': resourceType,
      'resourceId': resourceId,
      'reason': reason,
    });
  }
}

final reportsRepositoryProvider = Provider((ref) => ReportsRepository(ref.watch(apiClientProvider)));
