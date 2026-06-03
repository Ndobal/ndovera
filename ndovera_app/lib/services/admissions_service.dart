import 'api_client.dart';
import 'tenant_service.dart';

/// Submits a school admission application to POST /api/public/admissions.
///
/// Backend requires: tenantId, studentName, parentName, parentEmail,
/// desiredClass. Everything else is optional and stored on the application.
/// The tenantId is resolved automatically from the live tenant endpoint.
class AdmissionsService {
  AdmissionsService([ApiClient? client]) : _api = client ?? api;
  final ApiClient _api;

  Future<void> submit(AdmissionApplication app, {String? tenantId}) async {
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
    await _api.postJson('/api/public/admissions', {
      'tenantId': id,
      ...app.toJson(),
    });
  }
}

/// Mirrors the fields the backend accepts on /api/public/admissions.
class AdmissionApplication {
  AdmissionApplication({
    required this.studentName,
    required this.parentName,
    required this.parentEmail,
    required this.desiredClass,
    this.gender = '',
    this.dateOfBirth = '',
    this.previousSchool = '',
    this.parentPhone = '',
    this.relationship = '',
    this.address = '',
    this.notes = '',
  });

  final String studentName;
  final String parentName;
  final String parentEmail;
  final String desiredClass;
  final String gender;
  final String dateOfBirth;
  final String previousSchool;
  final String parentPhone;
  final String relationship;
  final String address;
  final String notes;

  Map<String, dynamic> toJson() => {
        'studentName': studentName,
        'parentName': parentName,
        'parentEmail': parentEmail,
        'desiredClass': desiredClass,
        if (gender.isNotEmpty) 'gender': gender,
        if (dateOfBirth.isNotEmpty) 'dateOfBirth': dateOfBirth,
        if (previousSchool.isNotEmpty) 'previousSchool': previousSchool,
        if (parentPhone.isNotEmpty) 'parentPhone': parentPhone,
        if (relationship.isNotEmpty) 'relationship': relationship,
        if (address.isNotEmpty) 'address': address,
        if (notes.isNotEmpty) 'strengths': notes,
      };
}
