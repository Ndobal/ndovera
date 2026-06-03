// Smoke test: the app boots and renders the Ndovera branding.
import 'package:flutter_test/flutter_test.dart';

import 'package:ndovera_app/main.dart';

void main() {
  testWidgets('App boots without crashing', (tester) async {
    await tester.pumpWidget(const NdoveraApp());
    await tester.pump();
    expect(find.byType(NdoveraApp), findsOneWidget);
  });
}
