import 'package:flutter/material.dart';

import '../theme/brand.dart';

/// Eyebrow + title + optional subtitle used to head every marketing section.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    this.subtitle,
    this.center = true,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final bool center;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final align = center ? CrossAxisAlignment.center : CrossAxisAlignment.start;
    final accent = theme.brightness == Brightness.dark ? Brand.cyan : Brand.forest;
    return Column(
      crossAxisAlignment: align,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: theme.textTheme.labelLarge?.copyWith(
            color: accent,
            fontWeight: FontWeight.w700,
            letterSpacing: 2.5,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          title,
          textAlign: center ? TextAlign.center : TextAlign.start,
          style: theme.textTheme.headlineMedium?.copyWith(height: 1.15),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Text(
              subtitle!,
              textAlign: center ? TextAlign.center : TextAlign.start,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.textTheme.bodyLarge?.color?.withValues(alpha: 0.78),
                height: 1.6,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// The Ndovera wordmark (text-based logo so no asset is required).
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.color, this.fontSize = 22});
  final Color? color;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = color ?? (isDark ? Colors.white : Brand.maroon);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: fontSize * 1.5,
          height: fontSize * 1.5,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Brand.maroon, Brand.navy]),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text('N',
              style: TextStyle(
                  color: Brand.wheat,
                  fontWeight: FontWeight.w900,
                  fontSize: fontSize)),
        ),
        const SizedBox(width: 10),
        Text(
          'NDOVERA',
          style: TextStyle(
            color: base,
            fontWeight: FontWeight.w900,
            fontSize: fontSize,
            letterSpacing: 1.5,
          ),
        ),
      ],
    );
  }
}

/// Circular avatar generated from initials + a deterministic brand colour.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.size = 56});
  final String name;
  final double size;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Brand.accentFor(name),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.36,
        ),
      ),
    );
  }
}

/// A clean "logo" chip for the scrolling tenant-schools strip (initials based).
class SchoolLogoChip extends StatelessWidget {
  const SchoolLogoChip({super.key, required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 220,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: isDark ? Brand.darkSurface : Brand.paper,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Brand.gold.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          InitialsAvatar(name: name, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}
