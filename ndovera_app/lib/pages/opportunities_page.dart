import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/content.dart';
import '../theme/brand.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/responsive.dart';
import 'growth_partners_page.dart' show PageHero;

/// Opportunities (careers) page: job listings, career resources and success
/// stories. Applying routes to the login screen (where role routing happens).
class OpportunitiesPage extends StatelessWidget {
  const OpportunitiesPage({super.key});

  static const _resources = [
    Feature(Icons.description_outlined, 'Resume Builder',
        'Create a clean, professional CV with guided prompts and ready templates.'),
    Feature(Icons.record_voice_over_outlined, 'Interview Prep',
        'Practice common questions and learn what schools look for in candidates.'),
    Feature(Icons.trending_up_outlined, 'Industry Insights',
        'Stay current with trends and salary guides across the education sector.'),
  ];

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      children: [
        const PageHero(
          eyebrow: 'Opportunities',
          title: 'Build your career with NDOVERA and partner schools.',
          subtitle:
              'Discover roles across our network of schools, build your profile, and track '
              'your applications — all in one place.',
          gradient: [Brand.maroon, Brand.forest],
        ),
        _jobs(context),
        _resourcesSection(context),
        _cta(context),
      ],
    );
  }

  Widget _jobs(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Open roles',
            title: 'Current openings',
          ),
          const SizedBox(height: 28),
          Column(
            children: [for (final j in kJobs) _JobRow(job: j)],
          ),
        ],
      ),
    );
  }

  Widget _resourcesSection(BuildContext context) {
    return Section(
      tinted: true,
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Career resources',
            title: 'Tools to help you succeed.',
          ),
          const SizedBox(height: 36),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 20,
            runSpacing: 20,
            children: [
              for (final r in _resources)
                FeatureCard(
                  feature: r,
                  width: Breaks.value<double>(context, mobile: 320, tablet: 320, desktop: 340),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _cta(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Get started',
            title: 'Ready to apply?',
            subtitle:
                'Sign in to build your profile and apply. After a successful application you’ll '
                'be taken to the right dashboard for your role.',
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => context.go('/login'),
            icon: const Icon(Icons.login, size: 18),
            label: const Text('Sign in to apply'),
          ),
        ],
      ),
    );
  }
}

class _JobRow extends StatelessWidget {
  const _JobRow({required this.job});
  final JobPost job;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isMobile = Breaks.isMobile(context);
    return HoverLift(
      scale: 1.01,
      lift: 3,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? Brand.darkSurface : Brand.paper,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Brand.gold.withValues(alpha: 0.35)),
        ),
        child: Flex(
          direction: isMobile ? Axis.vertical : Axis.horizontal,
          crossAxisAlignment: isMobile ? CrossAxisAlignment.start : CrossAxisAlignment.center,
          children: [
            Expanded(
              flex: isMobile ? 0 : 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(job.title, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text('${job.org} • ${job.location}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.7),
                      )),
                ],
              ),
            ),
            if (isMobile) const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: (isDark ? Brand.cyan : Brand.forest).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(job.type,
                  style: TextStyle(
                      color: isDark ? Brand.cyan : Brand.forest, fontWeight: FontWeight.w600)),
            ),
            SizedBox(width: isMobile ? 0 : 16, height: isMobile ? 12 : 0),
            FilledButton(
              onPressed: () => context.go('/login'),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }
}
