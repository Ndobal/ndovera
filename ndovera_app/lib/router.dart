import 'package:go_router/go_router.dart';

import 'pages/growth_partners_page.dart';
import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/opportunities_page.dart';
import 'pages/tenant_pages.dart';
import 'services/auth_service.dart';

/// Central route table for the marketing + tenant sites and the login flow.
final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, _) => const HomePage()),
    GoRoute(path: '/growth-partners', builder: (_, _) => const GrowthPartnersPage()),
    GoRoute(path: '/opportunities', builder: (_, _) => const OpportunitiesPage()),
    GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
    GoRoute(
      path: '/welcome',
      builder: (_, state) => WelcomePage(user: state.extra as AuthUser?),
    ),

    // Tenant school site.
    GoRoute(path: '/tenant', builder: (_, _) => const TenantHomePage()),
    GoRoute(path: '/tenant/academics', builder: (_, _) => const TenantAcademicsPage()),
    GoRoute(path: '/tenant/gallery', builder: (_, _) => const TenantGalleryPage()),
    GoRoute(path: '/tenant/about', builder: (_, _) => const TenantAboutPage()),
    GoRoute(path: '/tenant/vision-mission', builder: (_, _) => const TenantVisionMissionPage()),
    GoRoute(path: '/tenant/contact', builder: (_, _) => const TenantContactPage()),
    GoRoute(path: '/tenant/admission', builder: (_, _) => const TenantAdmissionPage()),
  ],
);
