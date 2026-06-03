import '../config/tenant_config.dart';
import 'api_client.dart';

/// Public tenant-school site content from GET /api/public/tenant/:subdomain.
class TenantSite {
  TenantSite({
    required this.tenantId,
    required this.schoolName,
    required this.subdomain,
    required this.sections,
    required this.logoUrl,
  });

  /// Internal tenant id (now returned by the public endpoint) — used to scope
  /// enquiry and admission submissions.
  final String tenantId;
  final String schoolName;
  final String subdomain;
  final String? logoUrl;

  /// Raw website sections keyed by `section_key` (title/content/image_url/...).
  final Map<String, Map<String, dynamic>> sections;

  String sectionContent(String key, {String fallback = ''}) =>
      (sections[key]?['content'] ?? fallback).toString();

  String sectionTitle(String key, {String fallback = ''}) =>
      (sections[key]?['title'] ?? fallback).toString();
}

class TenantService {
  TenantService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  /// The most recently fetched site, used to resolve the tenantId for forms.
  static TenantSite? lastSite;
  static Future<TenantSite>? _inFlight;

  /// Fetches (and caches) the tenant site. Repeated calls reuse the cached
  /// result unless [force] is set.
  Future<TenantSite> fetch({String? subdomain, bool force = false}) {
    if (!force && _inFlight != null) return _inFlight!;
    return _inFlight = _fetch(subdomain ?? TenantConfig.subdomain);
  }

  Future<TenantSite> _fetch(String sub) async {
    final data = await _api.getJson('/api/public/tenant/$sub');
    final tenant = (data['tenant'] as Map?)?.cast<String, dynamic>() ?? const {};
    final branding = (data['branding'] as Map?)?.cast<String, dynamic>() ?? const {};
    final rawSections = (data['sections'] as List?) ?? const [];

    final sections = <String, Map<String, dynamic>>{};
    for (final s in rawSections.whereType<Map>()) {
      final m = s.cast<String, dynamic>();
      final key = (m['section_key'] ?? '').toString();
      if (key.isNotEmpty) sections[key] = m;
    }

    final site = TenantSite(
      tenantId: (tenant['id'] ?? '').toString(),
      schoolName: (tenant['schoolName'] ?? '').toString(),
      subdomain: (tenant['subdomain'] ?? sub).toString(),
      logoUrl: (branding['logoUrl'] ?? branding['logo_url'])?.toString(),
      sections: sections,
    );
    lastSite = site;
    return site;
  }
}

/// Resolves the tenantId to use for tenant-scoped writes, in priority order:
/// an explicit value, the live value from the public tenant endpoint, then the
/// optional TENANT_ID dart-define override.
String resolveTenantId([String? explicit]) {
  final e = (explicit ?? '').trim();
  if (e.isNotEmpty) return e;
  final live = TenantService.lastSite?.tenantId ?? '';
  if (live.isNotEmpty) return live;
  return TenantConfig.tenantId;
}
