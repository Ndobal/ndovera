import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/content.dart';
import '../theme/brand.dart';

/// Animated, auto-advancing hero background that cycles through audience
/// "scenes" (students, teachers, parents, owners). Supports keyboard
/// navigation (← / →) for accessibility and renders an overlaid headline.
class HeroCarousel extends StatefulWidget {
  const HeroCarousel({super.key, required this.overlay, this.height});

  /// Foreground content (headline, CTAs) painted above the moving background.
  final Widget overlay;
  final double? height;

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  int _index = 0;
  Timer? _timer;
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _go(1));
  }

  void _go(int delta) {
    setState(() => _index = (_index + delta) % kHeroSlides.length);
    if (_index < 0) _index += kHeroSlides.length;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.height ??
        Breaks.value<double>(context, mobile: 620, tablet: 600, desktop: 640);
    final slide = kHeroSlides[_index];

    return Focus(
      focusNode: _focus,
      autofocus: false,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent) {
          if (event.logicalKey == LogicalKeyboardKey.arrowRight) {
            _go(1);
            return KeyEventResult.handled;
          }
          if (event.logicalKey == LogicalKeyboardKey.arrowLeft) {
            _go(-1);
            return KeyEventResult.handled;
          }
        }
        return KeyEventResult.ignored;
      },
      child: SizedBox(
        height: h,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Animated gradient "scene" background.
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 900),
              child: DecoratedBox(
                key: ValueKey(_index),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: slide.gradient,
                  ),
                ),
                child: _SceneDecor(icon: slide.icon),
              ),
            ),
            // Readability scrim so any overlaid text passes contrast checks.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xCC000000), Color(0x33000000)],
                ),
              ),
            ),
            // Audience chip (top).
            Positioned(
              top: 24,
              left: 0,
              right: 0,
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  child: Container(
                    key: ValueKey('chip$_index'),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                    ),
                    child: Text(slide.audience,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5)),
                  ),
                ),
              ),
            ),
            // Foreground overlay (headline + CTAs).
            widget.overlay,
            // Dots + arrows.
            Positioned(
              bottom: 20,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _arrow(Icons.chevron_left, () => _go(-1)),
                  const SizedBox(width: 12),
                  ...List.generate(kHeroSlides.length, (i) {
                    final active = i == _index;
                    return GestureDetector(
                      onTap: () => setState(() => _index = i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: active ? 28 : 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: active ? Brand.cyan : Colors.white.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(width: 12),
                  _arrow(Icons.chevron_right, () => _go(1)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _arrow(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: const CircleBorder(),
      child: IconButton(
        onPressed: onTap,
        icon: Icon(icon, color: Colors.white),
        tooltip: icon == Icons.chevron_left ? 'Previous' : 'Next',
      ),
    );
  }
}

/// Subtle decorative icon montage so each gradient scene reads as a distinct
/// "background image" without bundling heavy assets.
class _SceneDecor extends StatelessWidget {
  const _SceneDecor({required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          right: -40,
          top: 40,
          child: Icon(icon, size: 320, color: Colors.white.withValues(alpha: 0.06)),
        ),
        Positioned(
          left: -30,
          bottom: -20,
          child: Icon(icon, size: 200, color: Colors.white.withValues(alpha: 0.05)),
        ),
      ],
    );
  }
}
