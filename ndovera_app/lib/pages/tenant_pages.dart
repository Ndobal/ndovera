import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/content.dart';
import '../services/admissions_service.dart';
import '../services/enquiry_service.dart';
import '../services/tenant_service.dart';
import '../theme/brand.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/contact_form.dart';
import '../widgets/marquee.dart';
import '../widgets/responsive.dart';
import 'growth_partners_page.dart' show PageHero;

const _school = TenantContent.schoolName;

/// Tenant testimonials (students / parents / teachers of the school).
const List<Testimonial> _tenantVoices = [
  Testimonial('Mrs. Bello', 'Parent',
      'The teachers know my daughter personally, and I can follow her progress every week.'),
  Testimonial('Emeka, SS2', 'Student',
      'The AI tutor helps me revise at my own pace. My grades have really improved.'),
  Testimonial('Mr. Okafor', 'Teacher',
      'I have the tools to plan and assess properly, so I can focus on actually teaching.'),
  Testimonial('Mrs. Hassan', 'Parent',
      'A warm, well-run school. Communication is clear and I always feel informed.'),
];

/// ---------------------------------------------------------------------------
/// Tenant home (school landing)
/// ---------------------------------------------------------------------------
class TenantHomePage extends StatefulWidget {
  const TenantHomePage({super.key});

  @override
  State<TenantHomePage> createState() => _TenantHomePageState();
}

class _TenantHomePageState extends State<TenantHomePage> {
  // Hydrate live school content from /api/public/tenant/:subdomain.
  late final Future<TenantSite?> _site = TenantService().fetch().then<TenantSite?>((s) => s).catchError((_) => null);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<TenantSite?>(
      future: _site,
      builder: (context, snap) {
        final name = (snap.data?.schoolName.isNotEmpty ?? false) ? snap.data!.schoolName : _school;
        return AppScaffold(
          tenant: true,
          schoolName: name,
          children: [
            _TenantHero(schoolName: name),
            _highlights(context),
            _voices(context),
            _galleryTeaser(context),
            _aboutStrip(context),
            _contact(context),
          ],
        );
      },
    );
  }

  Widget _highlights(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Why families choose us',
            title: 'A modern education, grounded in care.',
          ),
          const SizedBox(height: 36),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 20,
            runSpacing: 20,
            children: [
              for (final f in TenantContent.highlights)
                FeatureCard(
                  feature: f,
                  width: Breaks.value<double>(context, mobile: 320, tablet: 320, desktop: 340),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _voices(BuildContext context) {
    return Section(
      tinted: true,
      child: Column(
        children: [
          const SectionHeader(eyebrow: 'Our community', title: 'Voices from our school.'),
          const SizedBox(height: 28),
          Marquee(
            height: 230,
            pixelsPerSecond: 45,
            children: [for (final t in _tenantVoices) TestimonialCard(testimonial: t)],
          ),
        ],
      ),
    );
  }

  Widget _galleryTeaser(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(eyebrow: 'Gallery', title: 'Life at our school.'),
          const SizedBox(height: 28),
          const _GalleryGrid(count: 6),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () => context.go('/tenant/gallery'),
            child: const Text('View full gallery'),
          ),
        ],
      ),
    );
  }

  Widget _aboutStrip(BuildContext context) {
    final twoCol = Breaks.isDesktop(context);
    final about = const SectionHeader(
      eyebrow: 'About us',
      title: 'A community built on curiosity and care.',
      subtitle:
          'For over two decades we have helped students grow into confident, capable young '
          'people — combining strong academics with character and creativity.',
      center: false,
    );
    final vm = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ValueTile(
          icon: Icons.visibility_outlined,
          title: 'Our Vision',
          body: 'To be a leading school where every learner discovers their potential.',
        ),
        const SizedBox(height: 16),
        _ValueTile(
          icon: Icons.flag_outlined,
          title: 'Our Mission',
          body: 'To deliver excellent, well-rounded education in a safe, nurturing environment.',
        ),
      ],
    );
    return Section(
      tinted: true,
      child: twoCol
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [Expanded(child: about), const SizedBox(width: 48), Expanded(child: vm)],
            )
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [about, const SizedBox(height: 28), vm]),
    );
  }

  Widget _contact(BuildContext context) {
    return Section(
      child: Column(
        children: [
          const SectionHeader(
            eyebrow: 'Contact',
            title: 'Come and see us.',
            subtitle: 'Reach out to arrange a visit or ask any questions — we’d love to hear from you.',
          ),
          const SizedBox(height: 28),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ContactForm(
              cta: 'Send enquiry',
              onSubmit: (s) => EnquiryService().submit(
                name: s.name,
                email: s.email,
                message: s.message,
                sourcePage: '/tenant',
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => context.go('/tenant/admission'),
            icon: const Icon(Icons.app_registration, size: 18),
            label: const Text('Apply for admission'),
          ),
        ],
      ),
    );
  }
}

/// Auto-cycling tenant hero with Admission + Login CTAs.
class _TenantHero extends StatefulWidget {
  const _TenantHero({required this.schoolName});
  final String schoolName;
  @override
  State<_TenantHero> createState() => _TenantHeroState();
}

class _TenantHeroState extends State<_TenantHero> {
  static const _scenes = [
    [Color(0xFF0B3D2E), Color(0xFF06241B)],
    [Color(0xFF1B3A5B), Color(0xFF0A1A2B)],
    [Color(0xFF4A1C3A), Color(0xFF200717)],
  ];
  int _i = 0;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 5), (_) => setState(() => _i = (_i + 1) % _scenes.length));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = Breaks.isMobile(context);
    return SizedBox(
      height: isMobile ? 560 : 600,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 800),
            child: DecoratedBox(
              key: ValueKey(_i),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: _scenes[_i],
                ),
              ),
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [Color(0xCC000000), Color(0x22000000)],
              ),
            ),
          ),
          Center(
            child: ContentWidth(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(widget.schoolName,
                      textAlign: TextAlign.center,
                      style: (isMobile
                              ? Theme.of(context).textTheme.headlineLarge
                              : Theme.of(context).textTheme.displayMedium)
                          ?.copyWith(color: Colors.white, height: 1.05)),
                  const SizedBox(height: 16),
                  Text(TenantContent.tagline,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: isMobile ? 16 : 20)),
                  const SizedBox(height: 28),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 14,
                    runSpacing: 14,
                    children: [
                      FilledButton.icon(
                        onPressed: () => context.go('/tenant/admission'),
                        icon: const Icon(Icons.app_registration, size: 18),
                        label: const Text('Apply for admission'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.go('/login'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white, width: 1.5),
                        ),
                        icon: const Icon(Icons.login, size: 18),
                        label: const Text('Portal login'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Tenant sub-pages
/// ---------------------------------------------------------------------------
class TenantAcademicsPage extends StatelessWidget {
  const TenantAcademicsPage({super.key});

  static const _programmes = [
    Feature(Icons.child_care_outlined, 'Early Years', 'A playful, structured foundation for our youngest learners.'),
    Feature(Icons.menu_book_outlined, 'Primary', 'Strong literacy and numeracy with creativity woven throughout.'),
    Feature(Icons.science_outlined, 'Junior Secondary', 'Broad exploration across sciences, arts and humanities.'),
    Feature(Icons.school_outlined, 'Senior Secondary', 'Focused tracks preparing students for national exams and beyond.'),
    Feature(Icons.sports_soccer_outlined, 'Extracurriculars', 'Sports, music, debate and clubs that build character.'),
    Feature(Icons.computer_outlined, 'Digital Learning', 'An AI tutor and online resources that support every classroom.'),
  ];

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: [
        const PageHero(
          eyebrow: 'Academics',
          title: 'Curriculum, programmes and activities.',
          subtitle: 'A balanced education from early years through senior secondary.',
          gradient: [Color(0xFF0B3D2E), Color(0xFF06241B)],
        ),
        Section(
          child: Wrap(
            alignment: WrapAlignment.center,
            spacing: 20,
            runSpacing: 20,
            children: [
              for (final p in _programmes)
                FeatureCard(
                  feature: p,
                  width: Breaks.value<double>(context, mobile: 320, tablet: 320, desktop: 340),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class TenantGalleryPage extends StatelessWidget {
  const TenantGalleryPage({super.key});
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: const [
        PageHero(
          eyebrow: 'Gallery',
          title: 'Moments from school life.',
          subtitle: 'Facilities, events and the everyday joy of learning together.',
          gradient: [Color(0xFF1B3A5B), Color(0xFF0A1A2B)],
        ),
        Section(child: _GalleryGrid(count: 12)),
      ],
    );
  }
}

class TenantAboutPage extends StatelessWidget {
  const TenantAboutPage({super.key});
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: [
        const PageHero(
          eyebrow: 'About',
          title: 'Our story, our values, our community.',
          subtitle: 'Two decades of nurturing confident, capable young people.',
          gradient: [Color(0xFF4A1C3A), Color(0xFF200717)],
        ),
        Section(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Founded with a simple belief — that every child deserves an education that '
                  'sees them as an individual — our school has grown into a warm, ambitious '
                  'community. We pair high academic standards with genuine pastoral care, so '
                  'students leave us prepared not just for exams, but for life.',
                  style: TextStyle(fontSize: 18, height: 1.7),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class TenantVisionMissionPage extends StatelessWidget {
  const TenantVisionMissionPage({super.key});
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: [
        const PageHero(
          eyebrow: 'Vision & Mission',
          title: 'Where we are going, and how we get there.',
          subtitle: 'Our north star and the promises that guide our daily work.',
          gradient: [Color(0xFF0B3D2E), Color(0xFF1B3A5B)],
        ),
        Section(
          child: Column(
            children: [
              _ValueTile(
                icon: Icons.visibility_outlined,
                title: 'Our Vision',
                body: 'To be a leading school where every learner discovers their full potential '
                    'and grows into a confident, responsible citizen.',
              ),
              const SizedBox(height: 20),
              _ValueTile(
                icon: Icons.flag_outlined,
                title: 'Our Mission',
                body: 'To deliver excellent, well-rounded education in a safe and nurturing '
                    'environment, supported by dedicated teachers and modern tools.',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class TenantContactPage extends StatelessWidget {
  const TenantContactPage({super.key});
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: [
        const PageHero(
          eyebrow: 'Contact',
          title: 'Get in touch.',
          subtitle: 'Questions, visits or admissions — we’re here to help.',
          gradient: [Color(0xFF1B3A5B), Color(0xFF0A1A2B)],
        ),
        Section(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ContactForm(
              cta: 'Send message',
              onSubmit: (s) => EnquiryService().submit(
                name: s.name,
                email: s.email,
                message: s.message,
                sourcePage: '/tenant/contact',
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Admission page — captures the applicant details the backend needs.
class TenantAdmissionPage extends StatefulWidget {
  const TenantAdmissionPage({super.key});
  @override
  State<TenantAdmissionPage> createState() => _TenantAdmissionPageState();
}

class _TenantAdmissionPageState extends State<TenantAdmissionPage> {
  final _formKey = GlobalKey<FormState>();
  String _grade = 'Primary 1';
  bool _busy = false;

  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _dob = TextEditingController();
  final _parentName = TextEditingController();
  final _parentEmail = TextEditingController();
  final _parentPhone = TextEditingController();
  final _prevSchool = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();

  static const _grades = [
    'Creche', 'Nursery', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5',
    'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3',
  ];

  @override
  void dispose() {
    for (final c in [_firstName, _lastName, _dob, _parentName, _parentEmail, _parentPhone, _prevSchool, _address, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await AdmissionsService().submit(AdmissionApplication(
        studentName: '${_firstName.text.trim()} ${_lastName.text.trim()}'.trim(),
        parentName: _parentName.text.trim(),
        parentEmail: _parentEmail.text.trim(),
        desiredClass: _grade,
        dateOfBirth: _dob.text.trim(),
        parentPhone: _parentPhone.text.trim(),
        previousSchool: _prevSchool.text.trim(),
        address: _address.text.trim(),
        notes: _notes.text.trim(),
      ));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Application submitted — thank you! We will be in touch.')),
      );
      _formKey.currentState!.reset();
      for (final c in [_firstName, _lastName, _dob, _parentName, _parentEmail, _parentPhone, _prevSchool, _address, _notes]) {
        c.clear();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      tenant: true,
      schoolName: _school,
      children: [
        const PageHero(
          eyebrow: 'Admission',
          title: 'Apply to join our school.',
          subtitle: 'Complete the form below and our admissions team will contact you.',
          gradient: [Color(0xFF4A1C3A), Color(0xFF200717)],
        ),
        Section(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _two(
                    _field(_firstName, 'Applicant first name'),
                    _field(_lastName, 'Applicant last name'),
                    context,
                  ),
                  const SizedBox(height: 16),
                  _two(
                    _field(_dob, 'Date of birth', required: false, hint: 'DD/MM/YYYY'),
                    DropdownButtonFormField<String>(
                      initialValue: _grade,
                      decoration: const InputDecoration(labelText: 'Applying for class'),
                      items: [for (final g in _grades) DropdownMenuItem(value: g, child: Text(g))],
                      onChanged: (v) => setState(() => _grade = v ?? _grade),
                    ),
                    context,
                  ),
                  const SizedBox(height: 16),
                  _field(_parentName, 'Parent / guardian full name'),
                  const SizedBox(height: 16),
                  _two(
                    _field(_parentEmail, 'Parent email', keyboard: TextInputType.emailAddress, email: true),
                    _field(_parentPhone, 'Parent phone', required: false, keyboard: TextInputType.phone),
                    context,
                  ),
                  const SizedBox(height: 16),
                  _field(_prevSchool, 'Previous school (if any)', required: false),
                  const SizedBox(height: 16),
                  _field(_address, 'Home address', required: false, maxLines: 2),
                  const SizedBox(height: 16),
                  _field(_notes, 'Anything else we should know?', required: false, maxLines: 3),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _busy ? null : _submit,
                    icon: _busy
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send, size: 18),
                    label: Text(_busy ? 'Submitting…' : 'Submit application'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _two(Widget a, Widget b, BuildContext context) {
    if (Breaks.isMobile(context)) {
      return Column(children: [a, const SizedBox(height: 16), b]);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [Expanded(child: a), const SizedBox(width: 16), Expanded(child: b)],
    );
  }

  Widget _field(TextEditingController controller, String label,
      {int maxLines = 1, bool required = true, bool email = false, TextInputType? keyboard, String? hint}) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label, hintText: hint),
      validator: (v) {
        if (required && (v == null || v.trim().isEmpty)) return 'Required';
        if (email && v != null && v.isNotEmpty && !v.contains('@')) return 'Enter a valid email';
        return null;
      },
    );
  }
}

/// ---------------------------------------------------------------------------
/// Small shared tenant widgets
/// ---------------------------------------------------------------------------
class _ValueTile extends StatelessWidget {
  const _ValueTile({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: isDark ? Brand.darkSurface : Brand.paper,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Brand.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: isDark ? Brand.cyan : Brand.forest, size: 30),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleLarge?.copyWith(fontSize: 20)),
                const SizedBox(height: 8),
                Text(body, style: theme.textTheme.bodyMedium?.copyWith(height: 1.55)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A responsive grid of decorative "photo" tiles (gradient placeholders so no
/// image assets are needed).
class _GalleryGrid extends StatelessWidget {
  const _GalleryGrid({required this.count});
  final int count;

  static const _labels = [
    'Classrooms', 'Science Lab', 'Sports Day', 'Library', 'Art Studio', 'Graduation',
    'Music Room', 'Playground', 'Field Trip', 'Assembly', 'Computer Lab', 'Garden',
  ];
  static const _icons = [
    Icons.chair_alt_outlined, Icons.science_outlined, Icons.sports_soccer_outlined,
    Icons.local_library_outlined, Icons.palette_outlined, Icons.school_outlined,
    Icons.music_note_outlined, Icons.park_outlined, Icons.directions_bus_outlined,
    Icons.groups_outlined, Icons.computer_outlined, Icons.local_florist_outlined,
  ];

  @override
  Widget build(BuildContext context) {
    final cols = Breaks.value<int>(context, mobile: 2, tablet: 3, desktop: 3);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: count,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: cols,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 1.3,
      ),
      itemBuilder: (context, i) {
        final color = Brand.palette[i % Brand.palette.length];
        return HoverLift(
          scale: 1.03,
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color, color.withValues(alpha: 0.6)],
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -10,
                  bottom: -10,
                  child: Icon(_icons[i % _icons.length],
                      size: 90, color: Colors.white.withValues(alpha: 0.18)),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Align(
                    alignment: Alignment.bottomLeft,
                    child: Text(_labels[i % _labels.length],
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
