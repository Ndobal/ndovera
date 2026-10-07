// Smoke test: the app boots and renders the Ndovera branding.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ndovera_app/main.dart';

void main() {
  testWidgets('App boots without crashing', (tester) async {
    // A returning visitor: the start-up splash is skipped.
    SharedPreferences.setMockInitialValues({'ndovera.splash_seen': true});
    await tester.pumpWidget(const NdoveraApp());
    await tester.pump();
    expect(find.byType(NdoveraApp), findsOneWidget);
  });
}
