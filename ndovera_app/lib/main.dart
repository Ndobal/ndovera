import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'router.dart';
import 'theme/app_theme.dart';

/// App-wide light/dark theme controller, toggled from the nav bar.
final ThemeController themeController = ThemeController();

void main() {
  usePathUrlStrategy(); // clean URLs (no leading #/) for the website
  runApp(const NdoveraApp());
}

class NdoveraApp extends StatelessWidget {
  const NdoveraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) {
        return MaterialApp.router(
          title: 'NDOVERA — One platform for your whole school',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: mode,
          routerConfig: appRouter,
        );
      },
    );
  }
}
