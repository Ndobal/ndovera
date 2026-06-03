import 'package:flutter/material.dart';

/// Central brand palette for Ndovera, mirrored from the existing React app
/// (maroon / navy / wheat / forest-green / gold, with neon accents in dark mode).
class Brand {
  Brand._();

  // Core brand colours (light).
  static const Color maroon = Color(0xFF800000);
  static const Color maroonDeep = Color(0xFF800020);
  static const Color navy = Color(0xFF191970);
  static const Color forest = Color(0xFF1A5C38);
  static const Color forestDeep = Color(0xFF154A2E);
  static const Color gold = Color(0xFFC9A96E);
  static const Color wheat = Color(0xFFF5DEB3);
  static const Color wheatDeep = Color(0xFFF0D090);
  static const Color cream = Color(0xFFFFF8ED);
  static const Color paper = Color(0xFFFFFDF8);

  // Neon accents used in dark mode.
  static const Color cyan = Color(0xFF00FFFF);
  static const Color purple = Color(0xFFBF00FF);
  static const Color neonGreen = Color(0xFF39FF14);

  // Dark surfaces.
  static const Color darkBg = Color(0xFF1A0010);
  static const Color darkSurface = Color(0xFF2A001F);
  static const Color darkSurfaceAlt = Color(0xFF35042A);

  /// A warm marketing gradient used on heros and CTAs (light).
  static const List<Color> heroLight = [
    Color(0xFF800020),
    Color(0xFF5A0030),
    Color(0xFF191970),
  ];

  /// Hero gradient (dark) with neon edge.
  static const List<Color> heroDark = [
    Color(0xFF2A001F),
    Color(0xFF12001A),
    Color(0xFF00121A),
  ];

  /// Distinct accent colours for generating avatars / logo chips without images.
  static const List<Color> palette = [
    maroon,
    navy,
    forest,
    Color(0xFF9C3D00),
    Color(0xFF055160),
    Color(0xFF5B2A86),
    Color(0xFF8A6D00),
    Color(0xFF1B5E20),
  ];

  static Color accentFor(String seed) {
    if (seed.isEmpty) return maroon;
    final code = seed.codeUnitAt(0) + seed.length;
    return palette[code % palette.length];
  }
}

/// Layout breakpoints + small responsive helpers.
class Breaks {
  Breaks._();
  static const double mobile = 700;
  static const double tablet = 1100;
  static const double maxContent = 1200;

  static bool isMobile(BuildContext c) => MediaQuery.sizeOf(c).width < mobile;
  static bool isTablet(BuildContext c) {
    final w = MediaQuery.sizeOf(c).width;
    return w >= mobile && w < tablet;
  }

  static bool isDesktop(BuildContext c) => MediaQuery.sizeOf(c).width >= tablet;

  /// Picks a value by breakpoint.
  static T value<T>(
    BuildContext c, {
    required T mobile,
    T? tablet,
    required T desktop,
  }) {
    if (isMobile(c)) return mobile;
    if (isTablet(c)) return tablet ?? desktop;
    return desktop;
  }
}
