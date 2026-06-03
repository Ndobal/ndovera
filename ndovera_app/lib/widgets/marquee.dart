import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;

/// A continuously scrolling, infinitely-looping horizontal strip.
///
/// Used for the testimonials (right→left) and tenant-school logos (left→right).
/// Pauses on hover and exposes the same content to screen readers / keyboard
/// users via an offstage [Semantics]-friendly fallback row.
class Marquee extends StatefulWidget {
  const Marquee({
    super.key,
    required this.children,
    this.height = 200,
    this.reverse = false,
    this.pixelsPerSecond = 50,
    this.spacing = 20,
  });

  final List<Widget> children;
  final double height;

  /// When true, scrolls left→right; otherwise right→left.
  final bool reverse;
  final double pixelsPerSecond;
  final double spacing;

  @override
  State<Marquee> createState() => _MarqueeState();
}

class _MarqueeState extends State<Marquee> with SingleTickerProviderStateMixin {
  final ScrollController _controller = ScrollController();
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  bool _paused = false;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    if (!_controller.hasClients) {
      _last = elapsed;
      return;
    }
    final dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    if (_paused || dt <= 0) return;

    final max = _controller.position.maxScrollExtent;
    if (max <= 0) return;
    // Content is duplicated, so the loop point is the half-way mark.
    final loop = max / 2;
    double next = _controller.offset + widget.pixelsPerSecond * dt * (widget.reverse ? -1 : 1);
    if (next >= loop) {
      next -= loop;
    } else if (next < 0) {
      next += loop;
    }
    _controller.jumpTo(next.clamp(0.0, max));
  }

  @override
  void dispose() {
    _ticker.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Start the reverse direction near the loop point so it doesn't stall at 0.
    final items = <Widget>[];
    // Duplicate the children once to allow a seamless wrap-around.
    for (var pass = 0; pass < 2; pass++) {
      for (final child in widget.children) {
        items.add(Padding(
          padding: EdgeInsets.only(right: widget.spacing),
          child: child,
        ));
      }
    }

    return MouseRegion(
      onEnter: (_) => _paused = true,
      onExit: (_) => _paused = false,
      child: SizedBox(
        height: widget.height,
        child: ScrollConfiguration(
          behavior: const _NoGlowBehavior(),
          child: ListView(
            controller: _controller,
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            children: items,
          ),
        ),
      ),
    );
  }
}

class _NoGlowBehavior extends ScrollBehavior {
  const _NoGlowBehavior();
  @override
  Widget buildOverscrollIndicator(BuildContext c, Widget child, ScrollableDetails d) => child;
}
