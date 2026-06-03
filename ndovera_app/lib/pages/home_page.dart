import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/content.dart';
import '../services/pricing_service.dart';
import '../services/public_site_service.dart';
import '../theme/brand.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/contact_form.dart';
import '../widgets/hero_carousel.dart';
import '../widgets/marquee.dart';
import '../widgets/responsive.dart';

/// The Ndovera marketing landing page.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  // Live, AMI-editable marketing copy. Falls back to bundled copy if absent.
  Map<String, Map<String, dynamic>> _sections = const {};

  @override
  void initState() {
    super.initState();
    PublicSiteService().fetchSections().then((s) {
      if (mounted) setState(() => _sections = s);
    }).catchError((_) {/* keep bundled copy */});
  }

  /// Returns an AMI-configured value for any of [keys] (checking title/content),
  /// or [fallback] when nothing is set.
  String _copy(List<String> keys, String field, String fallback) {
    for (final k in keys) {
      final v = _sections[k]?[field];
      if (v != null && v.toString().trim().isNotEmpty) return v.toString();
    }
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      children: [
        _hero(context),
        _featuresSection(context),
        _logosSection(context),
        _pricingSection(context),
        _testimonialsSection(context),
        _contactSection(context),
      ],
    );
  }

  Widget _hero(BuildContext context) {
    final isMobile = Breaks.isMobile(context);
    return HeroCarousel(
      overlay: Center(
        child: ContentWidth(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 820),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _copy(const ['hero', 'home_hero', 'headline'], 'title',
                      'The all-in-one platform that runs your whole school.'),
                  textAlign: TextAlign.center,
                  style: (isMobile
                          ? Theme.of(context).textTheme.headlineMedium
                          : Theme.of(context).textTheme.displaySmall)
                      ?.copyWith(color: Colors.white, height: 1.1),
                ),
                const SizedBox(height: 18),
                Text(
                  _copy(const ['hero', 'home_hero', 'headline'], 'content',
                      'NDOVERA brings leadership, parents, teachers and students together — '
                      'fees, results, attendance, an AI tutor and a professional school website, '
                      'all in one place.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: isMobile ? 15 : 18,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: 28),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    FilledButton.icon(
                      onPressed: () => context.go('/login'),
                      icon: const Icon(Icons.login, size: 18),
                      label: const Text('Login to your dashboard'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.go('/tenant'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white, width: 1.5),
                      ),
                      icon: const Icon(Icons.school_outlined, size: 18),
                      label: const Text('See a school site'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _featuresSection(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Why NDOVERA',
            title: 'Everything a modern school needs, working together.',
            subtitle:
                'One trusted system for the office and the classroom — so owners lead well, '
                'parents stay informed, and learning stays strong.',
          ),
          const SizedBox(height: 40),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 20,
            runSpacing: 20,
            children: [
              for (final f in kFeatures)
                FeatureCard(
                  feature: f,
                  width: Breaks.value<double>(context, mobile: 320, tablet: 320, desktop: 360),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _logosSection(BuildContext context) {
    return Section(
      tinted: true,
      vertical: 56,
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Trusted by schools',
            title: 'Schools already growing with NDOVERA',
          ),
          const SizedBox(height: 28),
          // Left → right scrolling logo strip.
          Marquee(
            reverse: true,
            height: 80,
            pixelsPerSecond: 40,
            children: [for (final s in kTenantSchools) SchoolLogoChip(name: s)],
          ),
        ],
      ),
    );
  }

  Widget _pricingSection(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Pricing',
            title: 'Simple pricing for a strong start.',
            subtitle:
                'Pay onboarding first. From the next term, billing follows active users so '
                'growing schools can plan with less guesswork.',
          ),
          const SizedBox(height: 40),
          const _LivePricing(),
        ],
      ),
    );
  }

  Widget _testimonialsSection(BuildContext context) {
    return Section(
      tinted: true,
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Testimonials',
            title: 'Loved by owners, parents and teachers.',
          ),
          const SizedBox(height: 28),
          // Right → left scrolling testimonials.
          Marquee(
            height: 230,
            pixelsPerSecond: 45,
            children: [for (final t in kTestimonials) TestimonialCard(testimonial: t)],
          ),
        ],
      ),
    );
  }

  Widget _contactSection(BuildContext context) {
    final twoCol = Breaks.isDesktop(context);
    final form = ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: const ContactForm(cta: 'Request a demo', extraField: 'School name'),
    );
    final intro = ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 460),
      child: const SectionHeader(
        eyebrow: 'Contact',
        title: 'Bring NDOVERA to your school.',
        subtitle:
            'Tell us about your school and we’ll show you how NDOVERA can simplify your '
            'operations and strengthen your brand.',
        center: false,
      ),
    );

    return Section(
      child: twoCol
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: intro),
                const SizedBox(width: 48),
                Expanded(child: form),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [intro, const SizedBox(height: 28), form],
            ),
    );
  }
}

/// Fetches live pricing and renders cards, falling back to bundled plans while
/// loading or if the request fails/returns nothing.
class _LivePricing extends StatefulWidget {
  const _LivePricing();
  @override
  State<_LivePricing> createState() => _LivePricingState();
}

class _LivePricingState extends State<_LivePricing> {
  late final Future<List<PricingPlan>> _future = PricingService().fetchPlans();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PricingPlan>>(
      future: _future,
      builder: (context, snap) {
        final plans = (snap.hasData && snap.data!.isNotEmpty) ? snap.data! : kPlans;
        return Wrap(
          alignment: WrapAlignment.center,
          spacing: 20,
          runSpacing: 20,
          children: [for (final p in plans) _PricingCard(plan: p)],
        );
      },
    );
  }
}

class _PricingCard extends StatelessWidget {
  const _PricingCard({required this.plan});
  final PricingPlan plan;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final highlight = plan.highlighted;
    return HoverLift(
      child: Container(
        width: 320,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          gradient: highlight
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Brand.maroon, Brand.navy],
                )
              : null,
          color: highlight ? null : (isDark ? Brand.darkSurface : Brand.paper),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: highlight ? Colors.transparent : Brand.gold.withValues(alpha: 0.4),
          ),
          boxShadow: highlight
              ? [BoxShadow(color: Brand.maroon.withValues(alpha: 0.3), blurRadius: 30, offset: const Offset(0, 16))]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (highlight)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Brand.cyan,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text('Most popular',
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.w700, fontSize: 12)),
              ),
            if (highlight) const SizedBox(height: 14),
            Text(plan.name,
                style: theme.textTheme.titleLarge?.copyWith(
                    color: highlight ? Colors.white : null, fontSize: 22)),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(plan.price,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.headlineSmall?.copyWith(
                          color: highlight ? Colors.white : (isDark ? Brand.cyan : Brand.forest))),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(plan.cadence,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: (highlight ? Colors.white : theme.textTheme.bodyMedium?.color)
                                ?.withValues(alpha: 0.7))),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(plan.blurb,
                style: theme.textTheme.bodyMedium?.copyWith(
                    color: (highlight ? Colors.white : theme.textTheme.bodyMedium?.color)
                        ?.withValues(alpha: 0.85),
                    height: 1.5)),
            const SizedBox(height: 18),
            ...plan.perks.map((perk) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle,
                          size: 18, color: highlight ? Brand.cyan : Brand.forest),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(perk,
                            style: TextStyle(
                                color: highlight ? Colors.white : theme.textTheme.bodyMedium?.color)),
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: highlight
                  ? FilledButton(
                      onPressed: () => context.go('/login'),
                      style: FilledButton.styleFrom(
                          backgroundColor: Brand.cyan, foregroundColor: Colors.black),
                      child: const Text('Get started'),
                    )
                  : OutlinedButton(
                      onPressed: () => context.go('/login'),
                      child: const Text('Get started'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
