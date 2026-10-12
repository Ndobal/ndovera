import 'package:flutter/material.dart';
import 'package:ndovera_birthdays/ndovera_birthdays.dart';

import '../services/api_client.dart';
import '../services/auth_service.dart';

/// Birthdays in the app, from the ndovera_birthdays package. A new client is made for the
/// signed-in person and their school, and closed when the screen goes; the server decides
/// the school from the session and every answer must name the same school.
class BirthdaysPage extends StatefulWidget {
  const BirthdaysPage({super.key});
  @override
  State<BirthdaysPage> createState() => _BirthdaysPageState();
}

class _BirthdaysPageState extends State<BirthdaysPage> {
  BirthdayApi? _birthdays;
  String? _problem;

  @override
  void initState() {
    super.initState();
    final user = AuthService.instance.currentUser;
    final token = api.authToken;
    if (user == null || token == null || token.isEmpty || (user.tenantId ?? '').isEmpty) {
      _problem = 'Sign in with your school account to see birthdays.';
      return;
    }
    try {
      _birthdays = BirthdayApi(
        baseUrl: Uri.parse('${api.baseUrl}/api'),
        expectedSchoolId: user.tenantId!,
        accessToken: () async => api.authToken ?? '',
      );
    } catch (_) {
      _problem = 'Birthdays need a secure (https) connection to Ndovera.';
    }
  }

  @override
  void dispose() {
    _birthdays?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final birthdays = _birthdays;
    final role = AuthService.instance.currentUser?.role ?? '';
    final admin = role == 'owner' || role == 'hos';
    return Scaffold(
      appBar: AppBar(title: const Text('Birthdays')),
      body: birthdays == null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_problem ?? '')))
          : ListView(padding: const EdgeInsets.all(12), children: [
              BirthdayFeed(api: birthdays),
              BirthdayFeed(api: birthdays, memories: true),
              ListTile(
                leading: const Icon(Icons.cake),
                title: const Text('My birthday choice'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BirthdayConsentPage(api: birthdays))),
              ),
              if (admin) ...[
                ListTile(
                  leading: const Icon(Icons.rate_review_outlined),
                  title: const Text('Review birthday wishes'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BirthdayModerationPage(api: birthdays))),
                ),
                ListTile(
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text('Birthday settings'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BirthdaySettingsPage(api: birthdays))),
                ),
              ],
            ]),
    );
  }
}
