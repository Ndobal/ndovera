import 'package:flutter/material.dart';

import '../data/content.dart';
import '../theme/brand.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/responsive.dart';

/// Growth Partners page: pitch + success stories (left) and an application
/// form with a logo/photo upload affordance (right).
class GrowthPartnersPage extends StatelessWidget {
  const GrowthPartnersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      children: [
        const PageHero(
          eyebrow: 'Growth Partners',
          title: 'Grow with NDOVERA. Help schools run better.',
          subtitle:
              'Join a network of partners introducing NDOVERA to schools — and earn as the '
              'schools you onboard succeed.',
          gradient: [Brand.forest, Brand.navy],
        ),
        _body(context),
      ],
    );
  }

  Widget _body(BuildContext context) {
    final twoCol = Breaks.isDesktop(context);
    final stories = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          eyebrow: 'Partner stories',
          title: 'Partners already winning.',
          center: false,
        ),
        const SizedBox(height: 20),
        for (final s in kPartnerStories) ...[
          TestimonialCard(testimonial: s),
          const SizedBox(height: 16),
        ],
      ],
    );

    final form = const _PartnerApplicationForm();

    return Section(
      child: twoCol
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: stories),
                const SizedBox(width: 48),
                Expanded(child: form),
              ],
            )
          : Column(children: [stories, const SizedBox(height: 40), form]),
    );
  }
}

class _PartnerApplicationForm extends StatefulWidget {
  const _PartnerApplicationForm();

  @override
  State<_PartnerApplicationForm> createState() => _PartnerApplicationFormState();
}

class _PartnerApplicationFormState extends State<_PartnerApplicationForm> {
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: isDark ? Brand.darkSurface : Brand.paper,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Brand.gold.withValues(alpha: 0.4)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Apply to become a partner', style: theme.textTheme.titleLarge),
            const SizedBox(height: 20),
            _UploadField(),
            const SizedBox(height: 16),
            const _Field(label: 'Full name'),
            const SizedBox(height: 16),
            const _Field(label: 'Email', keyboard: TextInputType.emailAddress),
            const SizedBox(height: 16),
            const _Field(label: 'Company / organisation (optional)', required: false),
            const SizedBox(height: 16),
            const _Field(label: 'Why do you want to partner with us?', maxLines: 4),
            const SizedBox(height: 12),
            // NOTE: there is no growth-partner endpoint on the backend yet, so
            // this submit is local-only. Wire it once an endpoint exists
            // (e.g. POST /api/public/growth-partners) — no backend change made here.
            Text(
              'Note: partner applications aren’t connected to a backend yet — this is a local demo until an endpoint exists.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontStyle: FontStyle.italic,
                    color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                  ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () {
                if (_formKey.currentState!.validate()) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Application received — we’ll review and reach out.')),
                  );
                }
              },
              icon: const Icon(Icons.send, size: 18),
              label: const Text('Submit application'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Image-upload drop area. The visual + interaction is complete; wiring an
/// actual file to the backend needs the `file_picker` package (handoff note).
class _UploadField extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Logo/photo upload — connect file_picker to enable.')),
      ),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 28),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Brand.gold.withValues(alpha: 0.6),
            style: BorderStyle.solid,
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Icon(Icons.cloud_upload_outlined,
                size: 36, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            const Text('Upload profile picture or company logo'),
            const SizedBox(height: 4),
            Text('PNG or JPG, up to 5MB',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.6),
                    )),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    this.maxLines = 1,
    this.required = true,
    this.keyboard,
  });
  final String label;
  final int maxLines;
  final bool required;
  final TextInputType? keyboard;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      maxLines: maxLines,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null,
    );
  }
}

/// Reusable coloured page hero used by inner pages (growth, opportunities,
/// tenant subpages).
class PageHero extends StatelessWidget {
  const PageHero({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.gradient,
  });
  final String eyebrow;
  final String title;
  final String subtitle;
  final List<Color> gradient;

  @override
  Widget build(BuildContext context) {
    final isMobile = Breaks.isMobile(context);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: isMobile ? 64 : 96),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
      ),
      child: ContentWidth(
        child: Column(
          children: [
            Text(eyebrow.toUpperCase(),
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    letterSpacing: 2.5,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: (isMobile
                      ? Theme.of(context).textTheme.headlineMedium
                      : Theme.of(context).textTheme.displaySmall)
                  ?.copyWith(color: Colors.white, height: 1.15),
            ),
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9), fontSize: 17, height: 1.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
