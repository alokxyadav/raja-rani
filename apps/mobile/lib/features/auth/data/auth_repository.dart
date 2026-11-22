import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';

class AuthRepository {
  AuthRepository(this._apiClient, this._tokenStorage);

  final ApiClient _apiClient;
  final TokenStorage _tokenStorage;

  Future<void> register({
    required String name,
    String? email,
    String? phone,
    required String password,
  }) async {
    final res = await _apiClient.dio.post('/api/v1/auth/register', data: {
      'name': name,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
    });
    await _saveSession(res.data);
  }

  Future<void> login({String? email, String? phone, required String password}) async {
    final res = await _apiClient.dio.post('/api/v1/auth/login', data: {
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
    });
    await _saveSession(res.data);
  }

  Future<void> requestOtp(String phone) async {
    await _apiClient.dio.post('/api/v1/auth/otp/request', data: {
      'phone': phone,
      'purpose': 'LOGIN',
    });
  }

  Future<void> verifyOtp({required String phone, required String code}) async {
    final res = await _apiClient.dio.post('/api/v1/auth/otp/verify', data: {
      'phone': phone,
      'code': code,
    });
    await _saveSession(res.data);
  }

  Future<void> loginWithGoogle(String idToken) async {
    final res = await _apiClient.dio.post('/api/v1/auth/google', data: {'idToken': idToken});
    await _saveSession(res.data);
  }

  Future<void> logout() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken != null) {
      try {
        await _apiClient.dio.post('/api/v1/auth/logout', data: {'refreshToken': refreshToken});
      } on DioException {
        // Best-effort server-side revocation; clear the local session
        // regardless so the user isn't stuck logged in on this device.
      }
    }
    await _tokenStorage.clear();
  }

  Future<void> _saveSession(Map<String, dynamic> data) => _tokenStorage.saveTokens(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
      );
}
