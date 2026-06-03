import '../data/content.dart';
import 'api_client.dart';

/// Fetches live pricing from GET /api/tenants/pricing and maps the backend
/// plan shape (key/label/description/setupFee/studentFeePerTerm/features/
/// manualPricing) into the UI's [PricingPlan].
class PricingService {
  PricingService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  Future<List<PricingPlan>> fetchPlans() async {
    final data = await _api.getJson('/api/tenants/pricing');
    final raw = (data['plans'] as List?) ?? const [];
    final plans = raw
        .whereType<Map>()
        .map((p) => _map(p.cast<String, dynamic>()))
        .toList();
    return plans;
  }

  PricingPlan _map(Map<String, dynamic> p) {
    final label = (p['label'] ?? p['key'] ?? 'Plan').toString();
    final manual = p['manualPricing'] == true || p['requiresManualReview'] == true;
    final setup = _num(p['setupFee']);
    final perTerm = _num(p['studentFeePerTerm']);
    final features = ((p['features'] as List?) ?? const [])
        .map((f) => f.toString())
        .where((f) => f.isNotEmpty)
        .toList();

    final perks = <String>[
      if (!manual && perTerm > 0) '₦${_fmt(perTerm)} per user / term',
      ...features,
    ];

    return PricingPlan(
      label,
      manual ? "Let's talk" : '₦${_fmt(setup)}',
      manual ? 'tailored' : 'one-off setup',
      (p['description'] ?? '').toString(),
      perks.isEmpty ? const ['Contact us for details'] : perks,
      highlighted: (p['key'] ?? '').toString().toLowerCase() == 'growth',
    );
  }

  double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

  String _fmt(double v) {
    final s = v.toStringAsFixed(0);
    // Group thousands with commas.
    return s.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (m) => ',',
    );
  }
}
