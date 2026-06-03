import 'api_client.dart';
import 'tenant_service.dart';

/// Submits a tenant-school website enquiry (contact form) to
/// POST /api/public/website-enquiries.
///
/// Backend requires: tenantId, name, email, message. Optional: phone, subject,
/// sourcePage. The tenantId is resolved automatically from the live tenant
/// endpoint (loading it first if needed).
class EnquiryService {
  EnquiryService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  Future<void> submit({
    required String name,
    required String email,
    required String message,
    String? phone,
    String? subject,
    String sourcePage = '/contact',
    String? tenantId,
  }) async {
    var id = resolveTenantId(tenantId);
    if (id.isEmpty) {
      try {
        await TenantService(_api).fetch();
      } catch (_) {/* fall through to the guard below */}
      id = resolveTenantId(tenantId);
    }
    if (id.isEmpty) {
      throw ApiException('No school is configured for this site (missing tenantId).');
    }
    await _api.postJson('/api/public/website-enquiries', {
      'tenantId': id,
      'name': name,
      'email': email,
      'message': message,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (subject != null && subject.isNotEmpty) 'subject': subject,
      'sourcePage': sourcePage,
    });
  }
}
