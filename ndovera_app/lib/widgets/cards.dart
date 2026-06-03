import 'package:flutter/material.dart';

import '../data/content.dart';
import '../theme/brand.dart';
import 'common.dart';
import 'responsive.dart';

/// Feature tile with icon, title and body. Lifts on hover.
class FeatureCard extends StatelessWidget {
  const FeatureCard({super.key, required this.feature, this.width = 360});
  final Feature feature;
  final double width;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accent = isDark ? Brand.cyan : Brand.maroon;
    return HoverLift(
      child: Container(
        width: width,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? Brand.darkSurface : Brand.paper,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Brand.gold.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(feature.icon, color: accent, size: 28),
            ),
            const SizedBox(height: 18),
            Text(feature.title, style: theme.textTheme.titleLarge?.copyWith(fontSize: 20)),
            const SizedBox(height: 10),
            Text(
              feature.body,
              style: theme.textTheme.bodyMedium?.copyWith(
                height: 1.55,
                color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Quote card for the testimonials marquee.
class TestimonialCard extends StatelessWidget {
  const TestimonialCard({super.key, required this.testimonial});
  final Testimonial testimonial;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return HoverLift(
      scale: 1.02,
      child: Container(
        width: 360,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? Brand.darkSurfaceAlt : Brand.paper,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Brand.gold.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.format_quote, color: isDark ? Brand.cyan : Brand.forest, size: 32),
            const SizedBox(height: 10),
            Expanded(
              child: Text(
                testimonial.quote,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyLarge?.copyWith(height: 1.5),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                InitialsAvatar(name: testimonial.name, size: 44),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(testimonial.name, style: theme.textTheme.titleSmall),
                    Text(
                      testimonial.role,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-bleed section wrapper with optional tinted background + centered,
/// width-constrained content.
class Section extends StatelessWidget {
  const Section({super.key, required this.child, this.tinted = false, this.vertical = 72});
  final Widget child;
  final bool tinted;
  final double vertical;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = tinted
        ? (isDark ? Brand.darkSurface.withValues(alpha: 0.5) : Brand.wheat.withValues(alpha: 0.45))
        : Colors.transparent;
    final pad = Breaks.value<double>(context, mobile: 48, tablet: 64, desktop: vertical);
    return Container(
      width: double.infinity,
      color: bg,
      padding: EdgeInsets.symmetric(vertical: pad),
      child: ContentWidth(child: child),
    );
  }
}
