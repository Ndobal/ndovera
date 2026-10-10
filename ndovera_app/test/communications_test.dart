// Parent notifications (N20) in the app, against a mocked API.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ndovera_app/pages/communications_pages.dart';
import 'package:ndovera_app/services/api_client.dart';
import 'package:ndovera_app/services/communications_service.dart';

const overview = {
  'success': true,
  'settings': {'active': true, 'shortagePolicy': 'PAUSE_BATCH', 'consentConfirmed': true, 'pauses': {'whatsapp': ['credits']}},
  'wallet': {
    'whatsapp': {'spendable': 10, 'reserved': 0, 'used': 3, 'termAllowance': 10, 'gifts': 0, 'purchased': 0},
    'sms': {'spendable': 10, 'reserved': 0, 'used': 0, 'termAllowance': 10, 'gifts': 0, 'purchased': 0},
    'email': {'spendable': 0, 'reserved': 0, 'used': 0},
  },
  'waiting': [{'id': 'b1', 'type': 'notice', 'label': 'School notice', 'shortfall': {'whatsapp': 110}, 'counts': {'recipients': 120}}],
  'warnings': ['WhatsApp sending paused. This school notice needs 120 units; 10 are available. Buy 110 units for ₦1,672. Email and in-app notifications remain active.'],
  'prices': {
    'whatsapp': {'current': {'unitPriceKobo': 1520, 'billingMode': 'PAID'}},
    'sms': {'current': {'unitPriceKobo': 800, 'billingMode': 'PAID'}},
    'email': {'current': {'unitPriceKobo': 0, 'billingMode': 'FREE'}},
  },
  'packages': [10, 50, 100],
  'canChangeSettings': true,
  'canBuy': true,
};

void main() {
  test('naira formats kobo the way the school sees prices', () {
    expect(naira(1520), '₦15.20');
    expect(naira(167200), '₦1,672');
    expect(naira(800), '₦8');
  });

  test('the overview maps wallets, prices, waiting batches and the pause', () async {
    final client = ApiClient(client: MockClient((req) async => http.Response(jsonEncode(overview), 200, headers: {'content-type': 'application/json; charset=utf-8'})), baseUrl: 'https://test.local');
    final data = await CommunicationsService(client).overview();
    expect(data.wallets['whatsapp']!.spendable, 10);
    expect(data.prices['email'], 0);
    expect(data.waiting.single.shortfall['whatsapp'], 110);
    expect(data.paused['whatsapp'], ['credits']);
    expect(data.active, isTrue);
  });

  test('a refusal from the server is an error, not a silent success', () async {
    final client = ApiClient(client: MockClient((req) async => http.Response(jsonEncode({'success': false, 'message': 'The smallest purchase is 10 units.'}), 400)), baseUrl: 'https://test.local');
    expect(() => CommunicationsService(client).buy('sms', 2), throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('smallest purchase'))));
  });

  testWidgets('the school screen shows the shortfall warning and what is waiting', (tester) async {
    final client = ApiClient(client: MockClient((req) async => http.Response(jsonEncode(overview), 200, headers: {'content-type': 'application/json; charset=utf-8'})), baseUrl: 'https://test.local');
    await tester.pumpWidget(MaterialApp(home: SchoolNotificationsPage(service: CommunicationsService(client))));
    await tester.pumpAndSettle();
    expect(find.textContaining('needs 120 units; 10 are available'), findsOneWidget);
    expect(find.textContaining('120 families · short 110 WhatsApp'), findsOneWidget);
    expect(find.text('Free'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Pay with Flutterwave'), 300);
    expect(find.text('Pay with Flutterwave'), findsOneWidget);
  });
}
