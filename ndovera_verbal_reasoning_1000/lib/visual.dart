import 'package:flutter/material.dart';
import 'engine.dart';

class QuestionVisual extends StatelessWidget {
  final Question question;
  final bool solved;
  const QuestionVisual({super.key, required this.question, this.solved = false});
  @override
  Widget build(BuildContext context) {
    final children = question.tokens.map((raw) {
      final value = solved ? raw.replaceAll('?', '${question.answer}') : raw;
      if (raw == 'circle' || raw == 'square') {
        return Semantics(label: raw, child: SizedBox(width: 28, height: 28,
          child: CustomPaint(painter: ShapePainter(raw))));
      }
      return Container(width: question.columns > 0 ? 68 : null,
        constraints: const BoxConstraints(minWidth: 44),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: raw.contains('?') ? const Color(0xfffff2cd) : const Color(0xffedf3ff),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xffc6d5ef))),
        child: Text(value, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)));
    }).toList();
    if (question.columns > 0) {
      return Column(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < children.length; i += question.columns)
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(
            mainAxisSize: MainAxisSize.min,
            children: children.sublist(i, i + question.columns)
              .map((w) => Padding(padding: const EdgeInsets.only(right: 6), child: w)).toList()))
      ]);
    }
    return Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center,
      children: children);
  }
}
class ShapePainter extends CustomPainter {
  final String shape;
  ShapePainter(this.shape);
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0xff2859a5);
    if (shape == 'circle') {
      canvas.drawCircle(Offset(size.width / 2, size.height / 2), size.width / 2 - 2, paint);
    } else {
      canvas.drawRect(Rect.fromLTWH(2, 2, size.width - 4, size.height - 4), paint);
    }
  }
  @override
  bool shouldRepaint(covariant ShapePainter oldDelegate) => oldDelegate.shape != shape;
}
