import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The Ndovera start-up animation (about five seconds).
///
/// 0.0–1.6s  the logo assembles: the shield's halves fly in from the upper
///           left and upper right, the N from the left, the gold curve from
///           the right, the torch drops from above, the cap sweeps in from the
///           upper right and the swoosh rises from below.
/// 1.6–3.6s  the finished logo turns a full 360°, dipping slightly in size.
/// 3.6–4.5s  it settles facing forward with a small elastic give and a glow.
/// 4.5–5.0s  it grows a touch while fading, then [onFinished] is called.
///
/// The layers in assets/branding/ndovera/ are cut from the real logo by
/// tool/split_logo.py and share one canvas, so the assembled frame is the
/// logo exactly.
class NdoveraSplashLoader extends StatefulWidget {
  const NdoveraSplashLoader({super.key, this.onFinished, this.size = 260});

  final VoidCallback? onFinished;
  final double size;

  static const Duration duration = Duration(milliseconds: 5000);

  @override
  State<NdoveraSplashLoader> createState() => _NdoveraSplashLoaderState();
}

const String _layerDir = 'assets/branding/ndovera';
const Color _background = Color(0xFF04120F);
const Color _backgroundGlow = Color(0xFF0B2A23);
const Color _emerald = Color(0xFF1F7A68);
const Color _gold = Color(0xFFD8B66A);

/// One piece of the logo and where it starts its flight.
class _Piece {
  const _Piece(this.asset, {required this.from, required this.turn, required this.start, this.clip});

  final String asset;

  /// Starting offset, as a fraction of the logo's size.
  final Offset from;

  /// Starting rotation, in radians.
  final double turn;

  /// When this piece sets off, as a fraction of the whole animation.
  final double start;

  /// Optional part of the layer to show (fractions of the canvas), so one
  /// layer can arrive as more than one piece.
  final Rect? clip;
}

// Each piece flies for 0.16 of the timeline; the last lands at 0.32 (1.6s).
const double _flight = 0.16;
const List<_Piece> _pieces = [
  _Piece('shield', from: Offset(-1.3, -1.1), turn: -0.55, start: 0.00, clip: Rect.fromLTRB(0, 0, 0.5, 1)),
  _Piece('shield', from: Offset(1.3, -1.1), turn: 0.55, start: 0.02, clip: Rect.fromLTRB(0.5, 0, 1, 1)),
  _Piece('letter_n', from: Offset(-1.6, 0.05), turn: -0.35, start: 0.05),
  _Piece('gold_curve', from: Offset(1.6, 0.05), turn: 0.4, start: 0.08),
  _Piece('torch', from: Offset(0, -1.5), turn: 0.15, start: 0.11),
  _Piece('graduation_cap', from: Offset(1.2, -1.2), turn: 0.9, start: 0.14),
  _Piece('swoosh', from: Offset(0, 1.4), turn: -0.2, start: 0.16),
];

class _NdoveraSplashLoaderState extends State<NdoveraSplashLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: NdoveraSplashLoader.duration);
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onFinished?.call();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Decode the layers first so no piece pops in late on a slow device.
    final precache = [
      for (final name in {..._pieces.map((piece) => piece.asset)}) precacheImage(AssetImage('$_layerDir/$name.png'), context),
    ];
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    Future.wait(precache).whenComplete(() {
      if (!mounted) return;
      if (reduceMotion) {
        // Show the finished logo briefly instead of the motion.
        _controller.value = 0.74;
        Future.delayed(const Duration(milliseconds: 900), () {
          if (mounted) _controller.animateTo(1, duration: const Duration(milliseconds: 300));
        });
      } else {
        _controller.forward();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _phase(double begin, double end, [Curve curve = Curves.linear]) {
    final t = ((_controller.value - begin) / (end - begin)).clamp(0.0, 1.0);
    return curve.transform(t);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _background,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final spin = _phase(0.32, 0.72, Curves.easeInOutCubic);
          final settle = _phase(0.72, 0.90);
          final exit = _phase(0.90, 1.0, Curves.easeIn);

          // Dips to 92% mid-turn for depth, gives a little elastic bounce on
          // settling, then grows to 105% while fading out.
          final spinScale = 1 - 0.08 * math.sin(spin * math.pi);
          final settleScale = settle > 0 && settle < 1 ? 1 + 0.035 * math.sin(settle * math.pi * 3) * (1 - settle) : 1.0;
          final scale = spinScale * settleScale * (1 + 0.05 * exit);
          final glow = _phase(0.70, 0.84, Curves.easeOut) * (1 - exit);
          final words = _phase(0.74, 0.88, Curves.easeOut);

          final logo = Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0012) // perspective, so the turn has depth
              ..rotateY(spin * 2 * math.pi)
              ..scaleByDouble(scale, scale, 1, 1),
            child: SizedBox.square(
              dimension: widget.size,
              child: Stack(
                clipBehavior: Clip.none,
                children: [for (final piece in _pieces) _buildPiece(piece)],
              ),
            ),
          );

          return Opacity(
            opacity: 1 - exit,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(colors: [_backgroundGlow, _background], radius: 0.9),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      clipBehavior: Clip.none,
                      children: [
                        // Soft emerald-and-gold glow behind the settled logo.
                        Container(
                          width: widget.size * 0.9,
                          height: widget.size * 0.9,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(color: _emerald.withValues(alpha: 0.45 * glow), blurRadius: 70, spreadRadius: 6),
                              BoxShadow(color: _gold.withValues(alpha: 0.28 * glow), blurRadius: 110, spreadRadius: 18),
                            ],
                          ),
                        ),
                        logo,
                      ],
                    ),
                    const SizedBox(height: 28),
                    Opacity(
                      opacity: words,
                      child: Transform.translate(
                        offset: Offset(0, 10 * (1 - words)),
                        child: Column(
                          children: [
                            Text(
                              'NDOVERA',
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 8, color: Colors.white),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Learn • Grow • Excel',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 13, fontWeight: FontWeight.w500, letterSpacing: 2, color: _gold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPiece(_Piece piece) {
    final t = _phase(piece.start, piece.start + _flight, Curves.easeOutCubic);
    final travel = 1 - t;
    Widget image = Image.asset(
      '$_layerDir/${piece.asset}.png',
      width: widget.size,
      height: widget.size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      gaplessPlayback: true,
    );
    if (piece.clip != null) image = ClipRect(clipper: _FractionClipper(piece.clip!), child: image);
    // Motion blur while in flight; dropped once landed so the logo is crisp.
    final blur = 6 * travel;
    if (blur > 0.3) image = ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: image);

    return Positioned.fill(
      child: Opacity(
        opacity: _phase(piece.start, piece.start + _flight * 0.6),
        child: Transform.translate(
          offset: piece.from * widget.size * travel,
          child: Transform.rotate(angle: piece.turn * travel, child: image),
        ),
      ),
    );
  }
}

class _FractionClipper extends CustomClipper<Rect> {
  const _FractionClipper(this.fraction);

  final Rect fraction;

  @override
  Rect getClip(Size size) => Rect.fromLTRB(
        fraction.left * size.width,
        fraction.top * size.height,
        fraction.right * size.width,
        fraction.bottom * size.height,
      );

  @override
  bool shouldReclip(_FractionClipper oldClipper) => oldClipper.fraction != fraction;
}

/// Remembers whether this visitor has already seen the splash.
abstract class SplashMemory {
  Future<bool> hasSeen();
  Future<void> markSeen();
}

class _PrefsSplashMemory implements SplashMemory {
  const _PrefsSplashMemory();

  static const String _key = 'ndovera.splash_seen';

  @override
  Future<bool> hasSeen() async => (await SharedPreferences.getInstance()).getBool(_key) ?? false;

  @override
  Future<void> markSeen() async => (await SharedPreferences.getInstance()).setBool(_key, true);
}

enum _GateStage { checking, showing, closing, done }

/// Shows [child] (the app) with the Ndovera splash over it on a visitor's first
/// visit only; a tap skips it. Returning visitors go straight to the app. The
/// app builds underneath, so a deep link is ready the moment the splash ends.
class NdoveraSplashGate extends StatefulWidget {
  const NdoveraSplashGate({super.key, required this.child, this.memory = const _PrefsSplashMemory()});

  final Widget child;
  final SplashMemory memory;

  @override
  State<NdoveraSplashGate> createState() => _NdoveraSplashGateState();
}

class _NdoveraSplashGateState extends State<NdoveraSplashGate> {
  _GateStage _stage = _GateStage.checking;

  @override
  void initState() {
    super.initState();
    // If storage cannot answer quickly, skip the splash rather than hold the app back.
    widget.memory.hasSeen().timeout(const Duration(milliseconds: 800)).then((seen) {
      if (!mounted) return;
      setState(() => _stage = seen ? _GateStage.done : _GateStage.showing);
      if (!seen) widget.memory.markSeen().catchError((_) {});
    }).catchError((_) {
      if (mounted) setState(() => _stage = _GateStage.done);
    });
  }

  void _close() {
    if (_stage == _GateStage.showing) setState(() => _stage = _GateStage.closing);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        // A plain cover for the moment it takes to check, so the page does not flash first.
        if (_stage == _GateStage.checking) const Positioned.fill(child: ColoredBox(color: _background)),
        if (_stage == _GateStage.showing || _stage == _GateStage.closing)
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _close,
              child: AnimatedOpacity(
                opacity: _stage == _GateStage.closing ? 0 : 1,
                duration: const Duration(milliseconds: 250),
                onEnd: () {
                  if (_stage == _GateStage.closing) setState(() => _stage = _GateStage.done);
                },
                child: Stack(
                  children: [
                    Positioned.fill(child: NdoveraSplashLoader(onFinished: () => setState(() => _stage = _GateStage.done))),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 28,
                      child: Text(
                        'Tap to skip',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white54, letterSpacing: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
