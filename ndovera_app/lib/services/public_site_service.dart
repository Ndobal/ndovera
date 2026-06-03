import 'api_client.dart';

/// Platform marketing content from GET /api/public/platform-site.
///
/// Sections are AMI-editable key/value blocks (section_key/title/content/
/// image_url/metadata). The landing page overlays these onto its defaults when
/// present, and falls back to built-in copy otherwise.
class PublicSiteService {
  PublicSiteService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  Future<Map<String, Map<String, dynamic>>> fetchSections() async {
    final data = await _api.getJson('/api/public/platform-site');
    final raw = (data['sections'] as List?) ?? const [];
    final out = <String, Map<String, dynamic>>{};
    for (final s in raw.whereType<Map>()) {
      final m = s.cast<String, dynamic>();
      final key = (m['section_key'] ?? '').toString();
      if (key.isNotEmpty) out[key] = m;
    }
    return out;
  }
}
