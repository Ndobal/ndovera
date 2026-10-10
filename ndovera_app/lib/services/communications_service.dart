import 'api_client.dart';

/// Parent notifications (N20): WhatsApp, SMS, email and in-app, with message units.
/// The same Worker API the web app uses (/api/communications, /api/super-admin/communications).
class CommunicationsService {
  CommunicationsService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  // School (Owner, HoS; bursars buy units)
  Future<CommOverview> overview() async => CommOverview.fromJson(await _api.getJson('/api/communications/overview'));
  Future<void> saveSettings(Map<String, dynamic> changes) => _api.patchJson('/api/communications/settings', changes);
  Future<String> recheckBatch(String batchId) async => ((await _api.postJson('/api/communications/batches/$batchId/admit', {}))['status'] ?? '').toString();
  Future<Map<String, dynamic>> preview(String title) async =>
      ((await _api.postJson('/api/communications/batches/preview', {'type': 'notice', 'scope': {'kind': 'school'}, 'facts': {'title': title}}))['preview'] as Map).cast<String, dynamic>();
  Future<void> sendNotice(String title) => _api.postJson('/api/communications/notices', {'title': title, 'idempotencyKey': DateTime.now().microsecondsSinceEpoch.toString()});

  /// A server-owned quote, then a Flutterwave checkout link. Units are added only after
  /// the server confirms the payment with Flutterwave.
  Future<String> buy(String channel, int units) async {
    final quote = (await _api.postJson('/api/communications/purchases/quote', {'channel': channel, 'units': units}))['quote'] as Map;
    final started = await _api.postJson('/api/communications/purchases', {'purchaseId': quote['id']});
    return (started['checkoutUrl'] ?? '').toString();
  }

  // Teachers: their own classes, counts only (read when opened).
  Future<Map<String, dynamic>> classNotifications() async => await _api.getJson('/api/communications/my-classes');

  // Parents
  Future<List<InboxItem>> inbox() async => ((await _api.getJson('/api/communications/inbox'))['items'] as List? ?? []).map((e) => InboxItem.fromJson((e as Map).cast<String, dynamic>())).toList();
  Future<void> markAllRead() => _api.postJson('/api/communications/inbox/read', {'ids': <String>[]});
  Future<Map<String, String>> myChoices() async {
    final data = await _api.getJson('/api/communications/my-choices');
    final choices = ((data['choices'] as Map?) ?? {}).map((k, v) => MapEntry(k.toString(), v.toString()));
    return {
      for (final channel in ['whatsapp', 'sms', 'email'])
        channel: choices[channel] ?? (channel == 'email' || data['schoolConfirmedConsent'] == true ? 'granted' : 'not set'),
    };
  }
  Future<void> setChoice(String channel, String status) => _api.putJson('/api/communications/my-choices', {channel: status});

  // Super Admin
  Future<List<SchoolWallet>> schoolWallets() async =>
      ((await _api.getJson('/api/super-admin/communications/schools'))['schools'] as List? ?? []).map((e) => SchoolWallet.fromJson((e as Map).cast<String, dynamic>())).toList();
  Future<List<Map<String, dynamic>>> gift({required List<String> tenantIds, required String channel, required int units, required String reason, String? expiresAt, required String idempotencyKey}) async {
    final data = await _api.postJson('/api/super-admin/communications/grants', {
      'tenantIds': tenantIds, 'channel': channel, 'units': units, 'reason': reason, 'expiresAt': ?expiresAt, 'idempotencyKey': idempotencyKey,
    });
    return ((data['results'] as List?) ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  }
  Future<List<Map<String, dynamic>>> templates() async =>
      ((await _api.getJson('/api/super-admin/communications/templates'))['templates'] as List? ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  Future<void> setTemplateStatus(String eventType, String metaName, String status) =>
      _api.putJson('/api/super-admin/communications/templates/$eventType', {'status': status, 'metaName': metaName});
  Future<List<Map<String, dynamic>>> unknownDeliveries() async =>
      ((await _api.getJson('/api/super-admin/communications/reconciliation'))['unknown'] as List? ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();
  Future<void> resolve(String deliveryId, bool sent) => _api.postJson('/api/super-admin/communications/deliveries/$deliveryId/resolve', {'decision': sent ? 'sent' : 'not_sent'});
}

String naira(num kobo) {
  final value = kobo / 100;
  final whole = value.truncate();
  final digits = whole.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  final fraction = ((value - whole) * 100).round();
  return '₦$digits${fraction == 0 ? '' : '.${fraction.toString().padLeft(2, '0')}'}';
}

const channelLabels = {'whatsapp': 'WhatsApp', 'sms': 'SMS', 'email': 'Email', 'inapp': 'In-app'};

class Wallet {
  Wallet({required this.spendable, required this.reserved, required this.used, required this.termAllowance, required this.gifts, required this.purchased});
  final int spendable, reserved, used, termAllowance, gifts, purchased;
  factory Wallet.fromJson(Map<String, dynamic> json) {
    int n(String key) => (json[key] as num?)?.toInt() ?? 0;
    return Wallet(spendable: n('spendable'), reserved: n('reserved'), used: n('used'), termAllowance: n('termAllowance'), gifts: n('gifts'), purchased: n('purchased'));
  }
}

class WaitingBatch {
  WaitingBatch({required this.id, required this.label, required this.shortfall, required this.families});
  final String id, label;
  final Map<String, int> shortfall;
  final int families;
  factory WaitingBatch.fromJson(Map<String, dynamic> json) => WaitingBatch(
        id: json['id'].toString(),
        label: (json['label'] ?? json['type'] ?? '').toString(),
        shortfall: ((json['shortfall'] as Map?) ?? {}).map((k, v) => MapEntry(k.toString(), (v as num).toInt())),
        families: (((json['counts'] as Map?) ?? {})['recipients'] as num?)?.toInt() ?? 0,
      );
}

class CommOverview {
  CommOverview({required this.active, required this.wallets, required this.prices, required this.waiting, required this.warnings, required this.policy, required this.paused, required this.canChangeSettings, required this.canBuy, required this.packages, required this.consentConfirmed});
  final Map<String, Wallet> wallets;
  final Map<String, int> prices; // kobo per unit; 0 = free
  final List<WaitingBatch> waiting;
  final List<String> warnings;
  final String policy;
  final Map<String, List<String>> paused;
  final bool active, canChangeSettings, canBuy, consentConfirmed;
  final List<int> packages;

  factory CommOverview.fromJson(Map<String, dynamic> json) {
    final wallet = (json['wallet'] as Map? ?? {}).cast<String, dynamic>();
    final prices = (json['prices'] as Map? ?? {}).cast<String, dynamic>();
    final settings = (json['settings'] as Map? ?? {}).cast<String, dynamic>();
    return CommOverview(
      active: settings['active'] == true,
      wallets: {for (final c in ['whatsapp', 'sms', 'email']) c: Wallet.fromJson(((wallet[c] as Map?) ?? {}).cast<String, dynamic>())},
      prices: {
        for (final c in ['whatsapp', 'sms', 'email'])
          c: (((prices[c] as Map?)?['current'] as Map?)?['billingMode'] == 'FREE') ? 0 : ((((prices[c] as Map?)?['current'] as Map?)?['unitPriceKobo'] as num?)?.toInt() ?? 0),
      },
      waiting: ((json['waiting'] as List?) ?? []).map((e) => WaitingBatch.fromJson((e as Map).cast<String, dynamic>())).toList(),
      warnings: ((json['warnings'] as List?) ?? []).map((e) => e.toString()).toList(),
      policy: (settings['shortagePolicy'] ?? 'PAUSE_BATCH').toString(),
      paused: ((settings['pauses'] as Map?) ?? {}).map((k, v) => MapEntry(k.toString(), ((v as List?) ?? []).map((e) => e.toString()).toList())),
      consentConfirmed: settings['consentConfirmed'] == true,
      canChangeSettings: json['canChangeSettings'] == true,
      canBuy: json['canBuy'] == true,
      packages: ((json['packages'] as List?) ?? [10, 50, 100, 500, 1000]).map((e) => (e as num).toInt()).toList(),
    );
  }
}

class InboxItem {
  InboxItem({required this.id, required this.title, required this.body, required this.link, required this.read, required this.createdAt});
  final String id, title, body, link, createdAt;
  final bool read;
  factory InboxItem.fromJson(Map<String, dynamic> json) => InboxItem(
        id: json['id'].toString(), title: (json['title'] ?? '').toString(), body: (json['body'] ?? '').toString(),
        link: (json['link'] ?? '').toString(), read: json['readAt'] != null, createdAt: (json['createdAt'] ?? '').toString(),
      );
}

class SchoolWallet {
  SchoolWallet({required this.id, required this.name, required this.whatsapp, required this.sms});
  final String id, name;
  final Wallet whatsapp, sms;
  factory SchoolWallet.fromJson(Map<String, dynamic> json) {
    final wallet = (json['wallet'] as Map? ?? {}).cast<String, dynamic>();
    return SchoolWallet(
      id: json['id'].toString(), name: (json['name'] ?? json['id']).toString(),
      whatsapp: Wallet.fromJson(((wallet['whatsapp'] as Map?) ?? {}).cast<String, dynamic>()),
      sms: Wallet.fromJson(((wallet['sms'] as Map?) ?? {}).cast<String, dynamic>()),
    );
  }
}
