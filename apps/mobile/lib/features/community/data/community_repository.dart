import '../../../core/network/api_client.dart';

class CommunityRepository {
  CommunityRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> getFeed({int page = 1}) async {
    final res = await _apiClient.dio.get('/api/v1/community/feed', queryParameters: {'page': page});
    return (res.data['items'] as List).cast<Map<String, dynamic>>();
  }

  Future<void> createPost(String body) async {
    await _apiClient.dio.post('/api/v1/community/posts', data: {'body': body});
  }

  Future<void> deletePost(String postId) async {
    await _apiClient.dio.delete('/api/v1/community/posts/$postId');
  }
}
