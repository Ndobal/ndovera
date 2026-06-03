import 'dart:convert';

import 'package:http/http.dart' as http;

/// Thin wrapper over the existing Ndovera Cloudflare Worker API.
///
/// The base URL defaults to production and is overridable at build/run time:
///   flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8787
///
/// A custom [http.Client] can be injected for tests (see test/services_test.dart).
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? defaultBaseUrl;

  static const String defaultBaseUrl =
      String.fromEnvironment('API_BASE', defaultValue: 'https://ndovera.com');

  final http.Client _client;
  final String baseUrl;

  /// Bearer token applied to subsequent requests once a user signs in.
  String? authToken;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final cleaned = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && v.toString().isNotEmpty) cleaned[k] = v.toString();
    });
    return Uri.parse('$baseUrl$path').replace(
      queryParameters: cleaned.isEmpty ? null : cleaned,
    );
  }

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        if (authToken != null && authToken!.isNotEmpty) 'Authorization': 'Bearer $authToken',
      };

  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) async {
    final res = await _client.get(_uri(path, query), headers: _headers(json: false));
    return _parse(res);
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final res = await _client.post(_uri(path), headers: _headers(), body: jsonEncode(body));
    return _parse(res);
  }

  Map<String, dynamic> _parse(http.Response res) {
    Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(res.body);
      data = decoded is Map<String, dynamic> ? decoded : {'data': decoded};
    } catch (_) {
      data = const {};
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (data['error'] ?? data['message'] ?? 'Request failed (${res.statusCode}).').toString();
      throw ApiException(msg, statusCode: res.statusCode);
    }
    return data;
  }
}

/// Shared application-wide client instance.
final ApiClient api = ApiClient();

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}
