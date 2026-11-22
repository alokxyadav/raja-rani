import '../../../core/network/api_client.dart';
import 'course_models.dart';

class CoursesRepository {
  CoursesRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<CourseSummary>> listCourses({
    String? search,
    String? categoryId,
    String? accessType,
    double? minPrice,
    double? maxPrice,
    int? minRating,
    String? sort,
  }) async {
    final res = await _apiClient.dio.get('/api/v1/courses', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'categoryId': categoryId,
      if (accessType != null) 'accessType': accessType,
      if (minPrice != null) 'minPrice': minPrice,
      if (maxPrice != null) 'maxPrice': maxPrice,
      if (minRating != null) 'minRating': minRating,
      if (sort != null) 'sort': sort,
    });
    final items = res.data['items'] as List;
    return items.map((e) => CourseSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CourseDetail> getCourse(String slug) async {
    final res = await _apiClient.dio.get('/api/v1/courses/$slug');
    return CourseDetail.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> enrollFree(String courseId) async {
    await _apiClient.dio.post('/api/v1/courses/$courseId/enroll-free');
  }

  Future<Map<String, dynamic>> createOrder(String courseId, {String? couponCode}) async {
    final res = await _apiClient.dio.post('/api/v1/orders', data: {
      'courseId': courseId,
      if (couponCode != null) 'couponCode': couponCode,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getLibrary() async {
    final res = await _apiClient.dio.get('/api/v1/library');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getActiveBanners() async {
    final res = await _apiClient.dio.get('/api/v1/banners/active');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getPlaybackToken(String lessonId) async {
    final res = await _apiClient.dio.get('/api/v1/lessons/$lessonId/playback-token');
    return res.data as Map<String, dynamic>;
  }

  Future<void> updateProgress(String lessonId, int positionSeconds, {bool? completed}) async {
    await _apiClient.dio.put('/api/v1/progress', data: {
      'lessonId': lessonId,
      'positionSeconds': positionSeconds,
      if (completed != null) 'completed': completed,
    });
  }

  Future<Map<String, dynamic>> getReviews(String courseId) async {
    final res = await _apiClient.dio.get('/api/v1/courses/$courseId/reviews');
    return res.data as Map<String, dynamic>;
  }

  Future<void> submitReview(String courseId, int rating, {String? body}) async {
    await _apiClient.dio.post('/api/v1/courses/$courseId/reviews', data: {
      'rating': rating,
      if (body != null && body.isNotEmpty) 'body': body,
    });
  }
}
