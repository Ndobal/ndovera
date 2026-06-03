import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../main.dart' show themeController;
import '../theme/brand.dart';
import 'common.dart';
import 'footer.dart';

class _NavDest {
  const _NavDest(this.label, this.path);
  final String label;
  final String path;
}

const List<_NavDest> _platformNav = [
  _NavDest('Home', '/'),
  _NavDest('Growth Partners', '/growth-partners'),
  _NavDest('Opportunities', '/opportunities'),
  _NavDest('For Schools', '/tenant'),
];

const List<_NavDest> _tenantNav = [
  _NavDest('Home', '/tenant'),
  _NavDest('Academics', '/tenant/academics'),
  _NavDest('Gallery', '/tenant/gallery'),
  _NavDest('About', '/tenant/about'),
  _NavDest('Vision & Mission', '/tenant/vision-mission'),
  _NavDest('Admission', '/tenant/admission'),
  _NavDest('Contact', '/tenant/contact'),
];

/// Shared page chrome: a fixed top navigation bar (with a Login button on
/// EVERY page), a scrollable body, and the site footer. Set [tenant] true to
/// switch the nav set + footer to the tenant-school site.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.children,
    this.tenant = false,
    this.schoolName,
  });

  final List<Widget> children;
  final bool tenant;
  final String? schoolName;

  @override
  Widget build(BuildContext context) {
    final nav = tenant ? _tenantNav : _platformNav;
    return Scaffold(
      drawer: _MobileDrawer(nav: nav, tenant: tenant, schoolName: schoolName),
      body: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverToBoxAdapter(child: _TopBar(nav: nav, tenant: tenant, schoolName: schoolName)),
        ],
        body: Builder(
          builder: (context) => SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ...children,
                SiteFooter(poweredByOnly: tenant, schoolName: schoolName),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.nav, required this.tenant, this.schoolName});
  final List<_NavDest> nav;
  final bool tenant;
  final String? schoolName;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final compact = MediaQuery.sizeOf(context).width < Breaks.tablet;
    return Material(
      elevation: 1,
      color: isDark ? Brand.darkBg.withValues(alpha: 0.96) : Brand.cream.withValues(alpha: 0.97),
      child: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: Breaks.maxContent),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => context.go(tenant ? '/tenant' : '/'),
                    child: tenant
                        ? Text(schoolName ?? 'Bright Future Academy',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 20))
                        : const BrandWordmark(),
                  ),
                  const Spacer(),
                  if (!compact)
                    ...nav.map((d) => Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: _NavTextLink(dest: d),
                        )),
                  if (!compact) const SizedBox(width: 8),
                  IconButton(
                    tooltip: isDark ? 'Light mode' : 'Dark mode',
                    onPressed: themeController.toggle,
                    icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
                  ),
                  const SizedBox(width: 8),
                  // Login button — present on every page.
                  FilledButton.icon(
                    onPressed: () => context.go('/login'),
                    icon: const Icon(Icons.login, size: 18),
                    label: const Text('Login'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    ),
                  ),
                  if (compact)
                    Builder(
                      builder: (context) => IconButton(
                        tooltip: 'Menu',
                        onPressed: () => Scaffold.of(context).openDrawer(),
                        icon: const Icon(Icons.menu),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavTextLink extends StatelessWidget {
  const _NavTextLink({required this.dest});
  final _NavDest dest;

  @override
  Widget build(BuildContext context) {
    final current = GoRouterState.of(context).uri.path;
    final active = current == dest.path;
    final color = active
        ? (Theme.of(context).brightness == Brightness.dark ? Brand.cyan : Brand.maroon)
        : Theme.of(context).textTheme.bodyLarge?.color;
    return TextButton(
      onPressed: () => context.go(dest.path),
      child: Text(
        dest.label,
        style: TextStyle(color: color, fontWeight: active ? FontWeight.w800 : FontWeight.w600),
      ),
    );
  }
}

class _MobileDrawer extends StatelessWidget {
  const _MobileDrawer({required this.nav, required this.tenant, this.schoolName});
  final List<_NavDest> nav;
  final bool tenant;
  final String? schoolName;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: tenant
                  ? Text(schoolName ?? 'Bright Future Academy',
                      style: Theme.of(context).textTheme.titleLarge)
                  : const BrandWordmark(),
            ),
            const Divider(),
            ...nav.map((d) => ListTile(
                  title: Text(d.label),
                  onTap: () {
                    Navigator.of(context).pop();
                    context.go(d.path);
                  },
                )),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () {
                Navigator.of(context).pop();
                context.go('/login');
              },
              icon: const Icon(Icons.login, size: 18),
              label: const Text('Login'),
            ),
          ],
        ),
      ),
    );
  }
}
