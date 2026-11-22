import 'package:dio/dio.dart';
import 'env.dart';
import '../storage/token_storage.dart';

/// One Dio instance for the whole app. Two interceptors:
/// 1. Attach the access token to every request except the auth endpoints
///    themselves (which don't have one yet).
/// 2. On a 401, try exactly once to refresh via the stored refresh token
///    and retry the original request. If refresh also fails, clear the
///    session — the router's redirect logic (app_router.dart) sends the
///    user back to login.
class ApiClient {
  ApiClient(this._tokenStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (!options.path.contains('/auth/')) {
            final token = await _tokenStorage.getAccessToken();
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final isRetry = error.requestOptions.extra['retried'] == true;

          if (isUnauthorized && !isRetry) {
            final refreshed = await _tryRefresh();
            if (refreshed) {
              final retryOptions = error.requestOptions;
              retryOptions.extra['retried'] = true;
              final token = await _tokenStorage.getAccessToken();
              retryOptions.headers['Authorization'] = 'Bearer $token';
              try {
                final response = await _dio.fetch(retryOptions);
                return handler.resolve(response);
              } catch (_) {
                // fall through to clearing the session below
              }
            }
            await _tokenStorage.clear();
          }

          handler.next(error);
        },
      ),
    );
  }

  late final Dio _dio;
  final TokenStorage _tokenStorage;

  Dio get dio => _dio;

  Future<bool> _tryRefresh() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // Bare Dio call (not this._dio, to avoid re-triggering interceptors)
      final response = await Dio(BaseOptions(baseUrl: Env.apiBaseUrl)).post(
        '/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      await _tokenStorage.saveTokens(
        accessToken: response.data['accessToken'],
        refreshToken: response.data['refreshToken'],
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
