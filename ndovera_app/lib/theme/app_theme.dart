import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'brand.dart';

/// Builds the light + dark [ThemeData] for the marketing experience.
///
/// Typography: Poppins for display/headings, Inter for body — both readable on
/// every surface (a hard requirement from the design brief).
class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: Brand.cream,
      colorScheme: ColorScheme.fromSeed(
        seedColor: Brand.maroon,
        primary: Brand.maroon,
        secondary: Brand.forest,
        tertiary: Brand.navy,
        surface: Brand.paper,
        brightness: Brightness.light,
      ),
    );
    return _withText(base, bodyColor: Brand.navy, headingColor: Brand.maroon);
  }

  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: Brand.darkBg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: Brand.purple,
        primary: Brand.cyan,
        secondary: Brand.neonGreen,
        tertiary: Brand.purple,
        surface: Brand.darkSurface,
        brightness: Brightness.dark,
      ),
    );
    return _withText(base, bodyColor: Colors.white, headingColor: Colors.white);
  }

  static ThemeData _withText(
    ThemeData base, {
    required Color bodyColor,
    required Color headingColor,
  }) {
    final display = GoogleFonts.poppinsTextTheme(base.textTheme);
    final body = GoogleFonts.interTextTheme(base.textTheme);
    final merged = display.copyWith(
      bodySmall: body.bodySmall?.copyWith(color: bodyColor),
      bodyMedium: body.bodyMedium?.copyWith(color: bodyColor),
      bodyLarge: body.bodyLarge?.copyWith(color: bodyColor),
      labelLarge: body.labelLarge?.copyWith(color: bodyColor),
      titleSmall: display.titleSmall?.copyWith(color: headingColor),
      titleMedium: display.titleMedium?.copyWith(color: headingColor),
      titleLarge: display.titleLarge?.copyWith(color: headingColor, fontWeight: FontWeight.w700),
      headlineSmall: display.headlineSmall?.copyWith(color: headingColor, fontWeight: FontWeight.w700),
      headlineMedium: display.headlineMedium?.copyWith(color: headingColor, fontWeight: FontWeight.w800),
      headlineLarge: display.headlineLarge?.copyWith(color: headingColor, fontWeight: FontWeight.w800),
      displaySmall: display.displaySmall?.copyWith(color: headingColor, fontWeight: FontWeight.w800),
      displayMedium: display.displayMedium?.copyWith(color: headingColor, fontWeight: FontWeight.w900),
      displayLarge: display.displayLarge?.copyWith(color: headingColor, fontWeight: FontWeight.w900),
    );

    return base.copyWith(
      textTheme: merged,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Brand.forest,
          foregroundColor: Brand.wheat,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: base.brightness == Brightness.dark ? Brand.cyan : Brand.maroon,
          side: BorderSide(
            color: base.brightness == Brightness.dark ? Brand.cyan : Brand.maroon,
            width: 1.5,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: base.brightness == Brightness.dark ? Brand.darkSurfaceAlt : Brand.paper,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Brand.gold.withValues(alpha: 0.5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Brand.gold.withValues(alpha: 0.4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: base.brightness == Brightness.dark ? Brand.cyan : Brand.maroon,
            width: 2,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: base.brightness == Brightness.dark ? Brand.darkSurface : Brand.paper,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
    );
  }
}

/// App-wide theme-mode controller (light/dark toggle).
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController() : super(ThemeMode.light);
  void toggle() =>
      value = value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
}
