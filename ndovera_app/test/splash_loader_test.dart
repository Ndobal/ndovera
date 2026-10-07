import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ndovera_app/widgets/ndovera_splash_loader.dart';

class _Memory implements SplashMemory {
  _Memory(this.seen);

  bool seen;

  @override
  Future<bool> hasSeen() async => seen;

  @override
  Future<void> markSeen() async => seen = true;
}

Future<void> _open(WidgetTester tester, SplashMemory memory) async {
  await tester.runAsync(() async {
    await tester.pumpWidget(MaterialApp(home: NdoveraSplashGate(memory: memory, child: const Text('Dashboard'))));
    // Let the visitor check finish, then the splash mount and decode its layer images.
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await tester.pump();
    await Future<void>.delayed(const Duration(milliseconds: 1000));
  });
  await tester.pump();
}

void main() {
  testWidgets('a first visit assembles the logo from its layers, then hands over to the app', (tester) async {
    final memory = _Memory(false);
    await _open(tester, memory);

    final layers = tester.widgetList<Image>(find.byType(Image)).map((image) => (image.image as AssetImage).assetName).toSet();
    expect(layers, {
      'assets/branding/ndovera/shield.png',
      'assets/branding/ndovera/letter_n.png',
      'assets/branding/ndovera/gold_curve.png',
      'assets/branding/ndovera/torch.png',
      'assets/branding/ndovera/graduation_cap.png',
      'assets/branding/ndovera/swoosh.png',
    });
    expect(memory.seen, isTrue, reason: 'remembered as soon as it starts');

    await tester.pump(const Duration(milliseconds: 2500));
    expect(find.byType(NdoveraSplashLoader), findsOneWidget, reason: 'still spinning mid-way');

    await tester.pump(const Duration(milliseconds: 2600));
    await tester.pump();
    expect(find.byType(NdoveraSplashLoader), findsNothing);
    expect(find.text('Dashboard'), findsOneWidget);
  });

  testWidgets('a tap skips the splash', (tester) async {
    await _open(tester, _Memory(false));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Tap to skip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(NdoveraSplashLoader), findsNothing);
  });

  testWidgets('a returning visitor goes straight to the app', (tester) async {
    await _open(tester, _Memory(true));
    expect(find.byType(NdoveraSplashLoader), findsNothing);
    expect(find.text('Dashboard'), findsOneWidget);
  });
}
