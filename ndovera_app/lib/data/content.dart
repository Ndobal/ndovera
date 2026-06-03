import 'package:flutter/material.dart';

/// Static marketing content for the Ndovera site, mirroring the sections of the
/// existing React `PublicSitePage` (hero, features, testimonials, pricing,
/// tenant logos) plus the growth-partner and opportunities flows.

class NavLink {
  const NavLink(this.label, this.path);
  final String label;
  final String path;
}

const List<NavLink> kMainNav = [
  NavLink('Home', '/'),
  NavLink('Features', '/#features'),
  NavLink('Pricing', '/#pricing'),
  NavLink('Growth Partners', '/growth-partners'),
  NavLink('Opportunities', '/opportunities'),
  NavLink('Contact', '/#contact'),
];

class Feature {
  const Feature(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;
}

const List<Feature> kFeatures = [
  Feature(Icons.dashboard_customize_outlined, 'Leadership Control',
      'Owners and heads of school see the whole operation — fees, staff, results — in one clear place.'),
  Feature(Icons.family_restroom_outlined, 'Parent Confidence',
      'Parents stay informed with attendance, results and school news they can actually trust.'),
  Feature(Icons.school_outlined, 'Better Learning Support',
      'An AI tutor and structured lesson tools help students revise and teachers stay strong.'),
  Feature(Icons.workspace_premium_outlined, 'A Stronger School Brand',
      'Each school gets a professional public website that makes it look as good as it runs.'),
  Feature(Icons.payments_outlined, 'Fees & Payroll',
      'Collect fees, approve payroll and keep a clean financial trail without the spreadsheets.'),
  Feature(Icons.insights_outlined, 'Real-time Progress',
      'Results, attendance and performance update live so decisions are based on today, not last term.'),
];

class Testimonial {
  const Testimonial(this.name, this.role, this.quote);
  final String name;
  final String role;
  final String quote;
}

const List<Testimonial> kTestimonials = [
  Testimonial('Mrs. Adaeze O.', 'School Owner',
      'NDOVERA gave me back control of my school. I can see fees, results and staff from anywhere.'),
  Testimonial('Mr. Tunde A.', 'Parent',
      'I finally know how my children are doing without chasing the school. The updates are clear.'),
  Testimonial('Miss Grace E.', 'Teacher',
      'Lesson plans, results and the AI tutor in one place. My classroom runs so much smoother now.'),
  Testimonial('Dr. Ibrahim K.', 'Head of School',
      'One system for the office and the classroom. Onboarding our staff took days, not months.'),
  Testimonial('Mrs. Chioma N.', 'Parent',
      'The school feels more professional, and I trust the information I get every week.'),
  Testimonial('Mr. Samuel B.', 'Growth Partner',
      'Helping schools adopt NDOVERA has been the most rewarding work I have done in edtech.'),
];

class PricingPlan {
  const PricingPlan(this.name, this.price, this.cadence, this.blurb, this.perks,
      {this.highlighted = false});
  final String name;
  final String price;
  final String cadence;
  final String blurb;
  final List<String> perks;
  final bool highlighted;
}

const List<PricingPlan> kPlans = [
  PricingPlan('Onboarding', '₦ One-off', 'paid now', 'A standard, guided launch for your school.', [
    'Full platform setup',
    'Staff & class import',
    'Branded school website',
    'Email support',
  ]),
  PricingPlan('Growth', 'Per active user', 'from next term', 'Billing follows real usage as you grow.', [
    'Everything in Onboarding',
    'AI tutor for students',
    'Fees & payroll workflows',
    'Priority support',
  ], highlighted: true),
  PricingPlan('Custom', "Let's talk", 'tailored', 'Extra rollout support for larger groups.', [
    'Everything in Growth',
    'Dedicated rollout planning',
    'Multi-campus management',
    'Onboarding specialist',
  ]),
];

/// Names used to generate clean initial-based "logo" chips (no image assets
/// required) for the scrolling tenant-schools strip.
const List<String> kTenantSchools = [
  'Bright Future Academy',
  'Greenfield College',
  'Royal Heights School',
  'Unity International',
  'Crescent Grammar',
  'Sunrise Montessori',
  'Pinnacle Academy',
  'Heritage High',
  'Cedarwood Schools',
  'Lighthouse College',
];

class HeroSlide {
  const HeroSlide(this.audience, this.headline, this.icon, this.gradient);
  final String audience;
  final String headline;
  final IconData icon;
  final List<Color> gradient;
}

const List<HeroSlide> kHeroSlides = [
  HeroSlide('For School Owners', 'Run your whole school from one calm dashboard.',
      Icons.account_balance_outlined, [Color(0xFF800020), Color(0xFF2A0030)]),
  HeroSlide('For Parents', 'Stay close to your child’s progress — every single week.',
      Icons.favorite_outline, [Color(0xFF191970), Color(0xFF0A0A3A)]),
  HeroSlide('For Teachers', 'Plan, teach and assess without drowning in paperwork.',
      Icons.menu_book_outlined, [Color(0xFF1A5C38), Color(0xFF04240F)]),
  HeroSlide('For Students', 'Learn with an AI tutor that explains things simply.',
      Icons.auto_awesome_outlined, [Color(0xFF5A0030), Color(0xFF120018)]),
];

/// Growth-partner success stories.
const List<Testimonial> kPartnerStories = [
  Testimonial('Aisha M.', 'Regional Partner',
      'I onboarded eleven schools in my first year. NDOVERA made the pitch easy.'),
  Testimonial('Daniel O.', 'Rollout Partner',
      'The training materials are excellent. Schools see value within the first week.'),
  Testimonial('Fatima S.', 'Education Supporter',
      'Backing NDOVERA means backing better-run schools across the region.'),
];

/// Sample opportunities / job listings.
class JobPost {
  const JobPost(this.title, this.org, this.location, this.type);
  final String title;
  final String org;
  final String location;
  final String type;
}

const List<JobPost> kJobs = [
  JobPost('Mathematics Teacher', 'Greenfield College', 'Lagos, NG', 'Full-time'),
  JobPost('School Administrator', 'Royal Heights School', 'Abuja, NG', 'Full-time'),
  JobPost('ICT Support Officer', 'Unity International', 'Remote', 'Contract'),
  JobPost('Growth Partner', 'NDOVERA', 'Nationwide', 'Partnership'),
  JobPost('Science Lab Assistant', 'Heritage High', 'Port Harcourt, NG', 'Part-time'),
];

/// Tenant-school landing content (kept generic; a real deployment would hydrate
/// this per tenant). Note: per brief, NDOVERA is only named in the footer.
class TenantContent {
  TenantContent._();
  static const String schoolName = 'Bright Future Academy';
  static const String tagline = 'Nurturing curious minds for a brighter tomorrow.';
  static const List<Feature> highlights = [
    Feature(Icons.psychology_alt_outlined, 'AI-Assisted Learning',
        'Every student gets patient, on-demand help that adapts to how they learn.'),
    Feature(Icons.route_outlined, 'Personalised Paths',
        'Lessons and revision tailored to each learner’s pace and goals.'),
    Feature(Icons.timeline_outlined, 'Real-time Progress',
        'Parents and teachers follow growth as it happens, not at term end.'),
  ];
}
