import 'package:flutter/material.dart';

import '../theme/brand.dart';

/// Constrains content to a max width and applies responsive horizontal padding.
class ContentWidth extends StatelessWidget {
  const ContentWidth({super.key, required this.child, this.vertical = 0});
  final Widget child;
  final double vertical;

  @override
  Widget build(BuildContext context) {
    final pad = Breaks.value<double>(context, mobile: 20, tablet: 40, desktop: 24);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: Breaks.maxContent),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: pad, vertical: vertical),
          child: child,
        ),
      ),
    );
  }
}

/// Wraps children in a hover-scale + pointer cursor effect (used by cards,
/// logos and testimonial tiles per the design brief).
class HoverLift extends StatefulWidget {
  const HoverLift({super.key, required this.child, this.scale = 1.03, this.lift = 6});
  final Widget child;
  final double scale;
  final double lift;

  @override
  State<HoverLift> createState() => _HoverLiftState();
}

class _HoverLiftState extends State<HoverLift> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        transform: Matrix4.translationValues(0, _hover ? -widget.lift : 0, 0)
          ..scaleByDouble(
            _hover ? widget.scale : 1.0,
            _hover ? widget.scale : 1.0,
            1.0,
            1.0,
          ),
        transformAlignment: Alignment.center,
        child: widget.child,
      ),
    );
  }
}
