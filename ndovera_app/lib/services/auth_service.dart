import 'api_client.dart';

/// Authentication against the existing Ndovera Worker API, layered on
/// [ApiClient]. On success the bearer token is applied to the shared client so
/// any future authenticated calls are signed.
class AuthService {
  AuthService([ApiClient? client]) : _api = client ?? api;
  AuthService._internal() : _api = api;

  static final AuthService instance = AuthService._internal();
  final ApiClient _api;

  AuthUser? _current;
  AuthUser? get currentUser => _current;
  bool get isSignedIn => _api.authToken != null && _api.authToken!.isNotEmpty;

  /// Sends `id` (email) + `password`, matching the React LoginForm contract.
  Future<AuthUser> login({required String id, required String password}) async {
    final data = await _api.postJson('/api/auth/login', {
      'id': id.trim(),
      'password': password,
    });

    final token = (data['token'] ?? '').toString();
    final rawUser = (data['user'] is Map ? data['user'] : data) as Map;
    final user = AuthUser.fromJson(rawUser.cast<String, dynamic>());
    _api.authToken = token.isEmpty ? null : token;
    _current = user;
    return user;
  }

  Future<String> requestPasswordReset(String email) async {
    final data = await _api.postJson('/api/auth/forgot-password', {'email': email.trim()});
    return (data['message'] ?? 'Check your email for the reset link.').toString();
  }

  void signOut() {
    _api.authToken = null;
    _current = null;
  }
}

class AuthUser {
  AuthUser({required this.id, required this.name, required this.role, this.tenantId});
  final String id;
  final String name;
  final String role;
  final String? tenantId;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    String pick(List<String> keys) {
      for (final k in keys) {
        final v = json[k];
        if (v != null && v.toString().trim().isNotEmpty) return v.toString();
      }
      return '';
    }

    final role = pick(['role', 'roles']).split(',').first.trim().toLowerCase();
    return AuthUser(
      id: pick(['id', 'email']),
      name: pick(['name', 'fullName', 'displayName']),
      role: role.isEmpty ? 'student' : role,
      tenantId: () {
        final t = pick(['tenantId', 'schoolId']);
        return t.isEmpty ? null : t;
      }(),
    );
  }
}

/// Kept for call sites that catch auth-specific failures; [ApiException] is the
/// canonical error type thrown by the client.
typedef AuthException = ApiException;
