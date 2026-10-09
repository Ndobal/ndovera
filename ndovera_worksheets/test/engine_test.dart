import 'package:flutter_test/flutter_test.dart';
import 'package:ndovera_worksheets/engine.dart';

void main() {
  test('All supported classes and topics produce unique, complete sets', () {
    for (var grade = 1; grade <= 6; grade++) {
      for (final topic in topicsForGrade(grade)) {
        for (var seed = 0; seed < 20; seed++) {
          final sheet = WorksheetEngine().generate(WorksheetSettings(
            grade: grade, topic: topic, count: 40, examples: 3, seed: seed));
          final all = [...sheet.examples, ...sheet.questions];
          expect(sheet.examples.length, 3);
          expect(sheet.questions.length, 40);
          expect(all.map((q) => q.signature).toSet().length, 43);
          for (final q in all) {
            expect(q.tokens.where((t) => t.contains('?')).length, 1);
            expect(q.answer, greaterThanOrEqualTo(0));
            if (topic == Topic.counting) {
              expect(q.answer, q.tokens.where((t) => t == 'circle' || t == 'square').length);
            }
            if (topic == Topic.grid) {
              final values = q.tokens.map((t) => t == '?' ? q.answer : int.parse(t)).toList();
              for (var row = 0; row < 3; row++) {
                final i = row * 3;
                expect(values[i + 1] - values[i], values[i + 2] - values[i + 1]);
              }
              for (var col = 0; col < 3; col++) {
                expect(values[col + 3] - values[col], values[col + 6] - values[col + 3]);
              }
            }
          }
        }
      }
    }
  });
  test('Unsupported topic/class and invalid sizes are rejected', () {
    expect(() => WorksheetEngine().generate(const WorksheetSettings(
      grade: 1, topic: Topic.fractions)), throwsArgumentError);
    expect(() => WorksheetEngine().generate(const WorksheetSettings(
      grade: 6, topic: Topic.grid, count: 100)), throwsArgumentError);
  });
  test('Seed reproduces the same worksheet', () {
    const settings = WorksheetSettings(grade: 4, topic: Topic.sequence, seed: 99);
    final a = WorksheetEngine().generate(settings);
    final b = WorksheetEngine().generate(settings);
    expect(a.questions.map((q) => q.signature), b.questions.map((q) => q.signature));
  });
}
