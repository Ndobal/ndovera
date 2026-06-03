// Unit tests for the API services using a mocked http.Client — no real
// network, so they run anywhere with no CORS concerns.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ndovera_app/services/admissions_service.dart';
import 'package:ndovera_app/services/api_client.dart';
import 'package:ndovera_app/services/auth_service.dart';
import 'package:ndovera_app/services/enquiry_service.dart';
import 'package:ndovera_app/services/pricing_service.dart';

ApiClient clientReturning(MockClientHandler handler) =>
    ApiClient(client: MockClient(handler), baseUrl: 'https://test.local');

void main() {
  test('PricingService maps backend plans into UI plans', () async {
    final client = clientReturning((req) async {
      expect(req.url.path, '/api/tenants/pricing');
      return http.Response(
        jsonEncode({
          'success': true,
          'plans': [
            {
              'key': 'growth',
              'label': 'Growth',
              'description': 'Billing follows usage',
              'setupFee': 50000,
              'studentFeePerTerm': 500,
              'features': ['AI tutor', 'Priority support'],
              'manualPricing': false,
            },
            {
              'key': 'custom',
              'label': 'Custom',
              'description': 'Tailored',
              'manualPricing': true,
              'features': [],
            },
          ],
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final plans = await PricingService(client).fetchPlans();
    expect(plans.length, 2);
    expect(plans.first.name, 'Growth');
    expect(plans.first.highlighted, isTrue);
    expect(plans.first.price, '₦50,000');
    expect(plans.first.perks, contains('₦500 per user / term'));
    expect(plans[1].price, "Let's talk");
  });

  test('AdmissionsService posts required fields plus tenantId', () async {
    Map<String, dynamic>? sent;
    final client = clientReturning((req) async {
      expect(req.url.path, '/api/public/admissions');
      sent = jsonDecode(req.body) as Map<String, dynamic>;
      return http.Response(jsonEncode({'success': true}), 200);
    });

    await AdmissionsService(client).submit(
      AdmissionApplication(
        studentName: 'Ada Obi',
        parentName: 'Mr Obi',
        parentEmail: 'obi@example.com',
        desiredClass: 'JSS 1',
      ),
      tenantId: 'tenant_123',
    );

    expect(sent!['tenantId'], 'tenant_123');
    expect(sent!['studentName'], 'Ada Obi');
    expect(sent!['desiredClass'], 'JSS 1');
  });

  test('EnquiryService refuses to submit without a tenantId', () async {
    final client = clientReturning((_) async => http.Response('{}', 200));
    await expectLater(
      EnquiryService(client).submit(name: 'A', email: 'a@b.com', message: 'Hi'),
      throwsA(isA<ApiException>()),
    );
  });

  test('ApiClient surfaces the server error message on failure', () async {
    final client = clientReturning(
      (_) async => http.Response(jsonEncode({'error': 'Invalid credentials'}), 401),
    );
    await expectLater(
      AuthService(client).login(id: 'x@y.com', password: 'nope'),
      throwsA(predicate((e) => e is ApiException && e.message == 'Invalid credentials')),
    );
  });

  test('AuthService stores token + parses user on success', () async {
    final client = clientReturning(
      (_) async => http.Response(
        jsonEncode({
          'token': 'jwt.token.here',
          'user': {'id': 'u1', 'name': 'Grace', 'role': 'teacher', 'tenantId': 't1'},
        }),
        200,
      ),
    );
    final auth = AuthService(client);
    final user = await auth.login(id: 'grace@school.com', password: 'pw');
    expect(user.name, 'Grace');
    expect(user.role, 'teacher');
    expect(client.authToken, 'jwt.token.here');
  });
}
