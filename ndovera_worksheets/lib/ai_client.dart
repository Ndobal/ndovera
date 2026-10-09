import 'dart:convert';
import 'package:http/http.dart' as http;
import 'engine.dart';

/// Integration boundary only: requires an existing authenticated Ndovera backend.
/// Call in a teacher route, then show the returned draft for teacher review.
/// This intentionally does not expose a provider API key in Flutter.
class NdoveraAiClient {
  final Uri baseUri;
  final http.Client client;
  final Future<String> Function() accessToken;
  NdoveraAiClient({required this.baseUri, required this.accessToken,
    required this.client}) {
    if (baseUri.scheme != 'https') throw ArgumentError('HTTPS is required.');
  }
  Future<Map<String, dynamic>> requestDraft(WorksheetSettings settings,
      {required String curriculumId, required String classroomId}) async {
    settings.validate();
    final token = await accessToken();
    if (token.isEmpty || curriculumId.isEmpty || classroomId.isEmpty) {
      throw ArgumentError('Authentication, curriculum and classroom are required.');
    }
    final response = await client.post(baseUri.resolve('/api/worksheets/generate'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({...settings.toJson(), 'curriculumId': curriculumId,
        'classroomId': classroomId})).timeout(const Duration(seconds: 45));
    if (response.statusCode != 200) {
      throw StateError('Worksheet generation failed (${response.statusCode}).');
    }
    if (response.bodyBytes.length > 1024 * 1024) {
      throw const FormatException('Worksheet response is too large.');
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic> || decoded['schemaVersion'] != 1) {
      throw const FormatException('Unsupported worksheet response.');
    }
    return decoded;
  }
}
