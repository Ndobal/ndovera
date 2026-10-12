import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

class BirthdayException implements Exception {
  final String message;
  BirthdayException(this.message);
  @override
  String toString() => message;
}

/// Construct a new client on login or school switch; dispose the old client.
/// No arbitrary school ID is accepted: the server resolves the session tenancy.
class BirthdayApi {
  final Uri baseUrl;
  final String expectedSchoolId;
  final Future<String> Function() accessToken;
  final http.Client _client;
  BirthdayApi({required this.baseUrl, required this.expectedSchoolId,
    required this.accessToken, http.Client? client}) : _client = client ?? http.Client() {
    if (baseUrl.scheme != 'https' || baseUrl.host.isEmpty ||
        baseUrl.hasQuery || baseUrl.hasFragment || baseUrl.userInfo.isNotEmpty ||
        expectedSchoolId.isEmpty) {
      throw ArgumentError('A HTTPS API origin and current school are required.');
    }
  }
  void dispose() => _client.close();
  Future<http.Response> _request(String method, String path,
      [Map<String, dynamic>? body]) async {
    final token = await accessToken();
    if (token.isEmpty) throw BirthdayException('Please sign in again.');
    final root = baseUrl.toString().replaceFirst(RegExp(r'/$'), '');
    final request = http.Request(method, Uri.parse('$root/birthdays$path'))
      ..followRedirects = false
      ..headers.addAll({'Authorization': 'Bearer $token',
        'Accept': 'application/json', 'Content-Type': 'application/json'});
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await _client.send(request).timeout(const Duration(seconds: 20)))
      .timeout(const Duration(seconds: 20));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw BirthdayException(switch (response.statusCode) {
        401 => 'Please sign in again.',
        403 => 'You do not have permission for this action.',
        404 => 'This celebration is unavailable.',
        409 => 'This record changed. Refresh and try again.',
        429 => 'Please wait before trying again.',
        _ => 'Birthday service unavailable. Please try again.',
      });
    }
    // Mandatory server-issued tenant envelope on every response, including images.
    if (response.headers['x-school-id'] != expectedSchoolId) {
      throw BirthdayException('School session mismatch. Please sign in again.');
    }
    return response;
  }
  Future<Map<String, dynamic>> _json(String method, String path,
      [Map<String, dynamic>? body]) async {
    final result = jsonDecode((await _request(method, path, body)).body);
    if (result is! Map<String, dynamic>) throw BirthdayException('Invalid server response.');
    return result;
  }
  String _id(String id) => Uri.encodeComponent(id);
  Future<List<Map<String, dynamic>>> list({bool memories = false}) async {
    final result = await _json('GET', memories ? '/memories' : '/today');
    return (result['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
  Future<Map<String, dynamic>> celebration(String id) => _json('GET', '/${_id(id)}');
  /// The card as SVG bytes (Ndovera draws cards as vector art); cardPng() in widgets.dart saves it as PNG.
  Future<Uint8List> card(String id) async => (await _request('GET', '/${_id(id)}/card')).bodyBytes;
  Future<String> suggest(String id, String style) async =>
    (await _json('POST', '/${_id(id)}/suggestions', {'style': style}))['message'] as String;
  Future<void> wish(String id, String message, String requestId) async {
    await _json('POST', '/${_id(id)}/wishes', {'message': message, 'requestId': requestId});
  }
  Future<List<Map<String, dynamic>>> wishes(String id) async {
    final result = await _json('GET', '/${_id(id)}/wishes');
    return (result['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
  Future<void> report(String id, String wishId, String reason) async {
    await _json('POST', '/${_id(id)}/wishes/${_id(wishId)}/report', {'reason': reason});
  }
  // Whether to be celebrated: staff opt out; students (or their parents) opt in.
  Future<Map<String, dynamic>> myConsent() => _json('GET', '/my-consent');
  Future<void> setMyConsent(bool celebrate) async { await _json('PUT', '/my-consent', {'celebrate': celebrate}); }
  Future<void> setChildConsent(String studentId, bool celebrate) async { await _json('PUT', '/consent/${_id(studentId)}', {'celebrate': celebrate}); }
  // Owner / Head of School: wishes waiting for review.
  Future<List<Map<String, dynamic>>> moderation() async {
    final result = await _json('GET', '/moderation');
    return (result['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
  Future<void> decide(String wishId, bool approve) async { await _json('POST', '/wishes/${_id(wishId)}/decision', {'decision': approve ? 'approve' : 'reject'}); }
  Future<Map<String, dynamic>> settings() => _json('GET', '/settings');
  Future<void> saveSettings(Map<String, dynamic> settings) async {
    await _json('PUT', '/settings', settings);
  }
}
