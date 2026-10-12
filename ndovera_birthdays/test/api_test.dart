import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ndovera_birthdays/ndovera_birthdays.dart';
void main() {
  BirthdayApi api(http.Client client) => BirthdayApi(baseUrl: Uri.parse('https://school.example/api'),
    expectedSchoolId: 'school-a', accessToken: () async => 'session-token', client: client);
  test('rejects another school before returning its feed', () async {
    final service = api(MockClient((request) async => http.Response(jsonEncode({'items': []}), 200,
      headers: {'x-school-id': 'school-b'})));
    await expectLater(service.list(), throwsA(isA<BirthdayException>()));
    service.dispose();
  });
  test('missing tenant envelope fails closed', () async {
    final service = api(MockClient((request) async => http.Response('{"items":[]}', 200)));
    await expectLater(service.list(), throwsA(isA<BirthdayException>()));
    service.dispose();
  });
  test('uses bearer session and never sends a school selector', () async {
    final service = api(MockClient((request) async {
      expect(request.headers['Authorization'], 'Bearer session-token');
      expect(request.url.path, '/api/birthdays/today');
      expect(request.url.query, isEmpty);
      return http.Response('{"items":[]}', 200, headers: {'x-school-id': 'school-a'});
    }));
    expect(await service.list(), isEmpty); service.dispose();
  });
  test('cross-school not-found is handled without returning content', () async {
    final service = api(MockClient((request) async => http.Response('private', 404)));
    await expectLater(service.card('foreign-card'), throwsA(isA<BirthdayException>()));
    service.dispose();
  });
  test('consent and moderation go to the session school only, with the same envelope check', () async {
    final calls = <String>[];
    final service = api(MockClient((request) async {
      calls.add('${request.method} ${request.url.path} ${request.body}');
      final body = request.url.path.endsWith('/moderation') ? '{"items":[]}' : '{"celebrate":true,"kind":"staff","children":[]}';
      return http.Response(body, 200, headers: {'x-school-id': 'school-a'});
    }));
    expect((await service.myConsent())['kind'], 'staff');
    await service.setChildConsent('s-1', true);
    expect(await service.moderation(), isEmpty);
    await service.decide('w-1', false);
    expect(calls, [
      'GET /api/birthdays/my-consent ',
      'PUT /api/birthdays/consent/s-1 {"celebrate":true}',
      'GET /api/birthdays/moderation ',
      'POST /api/birthdays/wishes/w-1/decision {"decision":"reject"}',
    ]);
    service.dispose();
  });
}
