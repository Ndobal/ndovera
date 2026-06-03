import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/brand.dart';
import 'common.dart';
import 'responsive.dart';

/// Site footer. When [poweredByOnly] is true (tenant sites) Ndovera is only
/// named in the "powered by" line, per the design brief.
class SiteFooter extends StatelessWidget {
  const SiteFooter({super.key, this.poweredByOnly = false, this.schoolName});
  final bool poweredByOnly;
  final String? schoolName;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      color: isDark ? Brand.darkSurface : Brand.maroon,
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: ContentWidth(
        child: Column(
          children: [
            if (poweredByOnly)
              Text(
                schoolName ?? 'Our School',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22),
              )
            else
              const BrandWordmark(color: Colors.white),
            const SizedBox(height: 18),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 24,
              runSpacing: 12,
              children: [
                _link(context, 'Home', '/'),
                _link(context, 'Growth Partners', '/growth-partners'),
                _link(context, 'Opportunities', '/opportunities'),
                _link(context, 'For Schools', '/tenant'),
                _link(context, 'Sign In', '/login'),
              ],
            ),
            const SizedBox(height: 24),
            Divider(color: Colors.white.withValues(alpha: 0.2)),
            const SizedBox(height: 16),
            Text(
              poweredByOnly
                  ? 'Powered by NDOVERA'
                  : '© ${DateTime.now().year} NDOVERA. All rights reserved.',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _link(BuildContext context, String label, String path) {
    return InkWell(
      onTap: () => context.go(path),
      child: Text(label,
          style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontWeight: FontWeight.w600)),
    );
  }
}
