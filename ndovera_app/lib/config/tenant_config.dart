/// Identifies which tenant school the tenant-facing screens belong to.
///
/// In production a tenant site is served from `<subdomain>.ndovera.com`, so the
/// subdomain is derived from the browser host automatically. For local/dev
/// testing you can override it:
///   flutter run -d chrome --dart-define=TENANT_SUBDOMAIN=greenfield
///
/// The internal tenantId is now returned by GET /api/public/tenant/:subdomain
/// (see TenantService), so it no longer needs to be supplied here. The optional
/// TENANT_ID define remains as a manual override for non-web/desktop testing.
class TenantConfig {
  TenantConfig._();

  static const String _subdomainDefine =
      String.fromEnvironment('TENANT_SUBDOMAIN', defaultValue: '');

  /// Manual tenantId override (rarely needed now that the API returns it).
  static const String tenantId =
      String.fromEnvironment('TENANT_ID', defaultValue: '');

  /// Resolves the tenant subdomain: explicit dart-define wins, else it is read
  /// from the web host (`greenfield.ndovera.com` -> `greenfield`), falling back
  /// to `demo` when there is no subdomain (e.g. localhost).
  static String get subdomain {
    if (_subdomainDefine.isNotEmpty) return _subdomainDefine;
    final host = Uri.base.host.toLowerCase();
    final parts = host.split('.');
    if (host.endsWith('ndovera.com') && parts.length >= 3 && parts.first != 'www') {
      return parts.first;
    }
    return 'demo';
  }
}
