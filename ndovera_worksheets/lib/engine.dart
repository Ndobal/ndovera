import 'dart:math';

enum WorksheetMode { assignment, practice, examination }
enum Topic { counting, sequence, missingNumber, numberMachine, fractions, grid }

extension TopicLabel on Topic {
  String get label => const ['Picture counting', 'Number patterns', 'Missing numbers',
    'Number machines', 'Equivalent fractions', 'Number grid puzzles'][index];
}

class WorksheetSettings {
  final int grade, count, examples, minutes, seed;
  final WorksheetMode mode;
  final Topic topic;
  final String title;
  const WorksheetSettings({required this.grade, required this.topic,
    this.count = 10, this.examples = 2, this.minutes = 30,
    this.seed = 1, this.mode = WorksheetMode.practice,
    this.title = 'Quantitative Reasoning'});
  void validate() {
    if (grade < 1 || grade > 6 || count < 5 || count > 40 ||
        examples < 2 || examples > 3 || minutes < 5 || minutes > 180 ||
        title.trim().isEmpty || title.length > 100 ||
        !topicsForGrade(grade).contains(topic)) {
      throw ArgumentError('Invalid worksheet settings or topic for class.');
    }
  }
  Map<String, dynamic> toJson() => {'grade': grade, 'topic': topic.name,
    'questionCount': count, 'exampleCount': examples, 'minutes': minutes,
    'seed': seed, 'mode': mode.name, 'title': title};
}

List<Topic> topicsForGrade(int grade) => [
  if (grade <= 3) Topic.counting,
  Topic.sequence, Topic.missingNumber,
  if (grade >= 2) Topic.numberMachine,
  if (grade >= 4) Topic.fractions,
  if (grade >= 3) Topic.grid,
];

/// Visuals are structured instructions, never text pretending to be an image.
/// Each token represents a cell; '?' is the single answer cell.
class Question {
  final String id, prompt, explanation;
  final List<String> tokens;
  final int answer, columns;
  final bool pictures;
  const Question({required this.id, required this.prompt, required this.tokens,
    required this.answer, required this.explanation,
    this.columns = 0, this.pictures = false});
  String get signature => '$prompt|${tokens.join(",")}';
}

class Worksheet {
  final WorksheetSettings settings;
  final List<Question> examples, questions;
  const Worksheet(this.settings, this.examples, this.questions);
}

class WorksheetEngine {
  Worksheet generate(WorksheetSettings settings) {
    settings.validate();
    final random = Random(settings.seed);
    final seen = <String>{};
    final items = <Question>[];
    var attempts = 0;
    while (items.length < settings.count + settings.examples) {
      if (++attempts > 20000) {
        throw StateError('Cannot generate enough unique questions. Reduce count.');
      }
      final q = _question(settings, random, items.length);
      if (seen.add(q.signature)) items.add(q);
    }
    return Worksheet(settings,
      List.unmodifiable(items.take(settings.examples)),
      List.unmodifiable(items.skip(settings.examples)));
  }

  Question _question(WorksheetSettings s, Random r, int index) {
    final g = s.grade;
    int pick(int max) => 1 + r.nextInt(max);
    Question make(String prompt, List<String> tokens, int answer,
        String explanation, {int columns = 0, bool pictures = false}) =>
      Question(id: 'q$index', prompt: prompt, tokens: tokens, answer: answer,
        explanation: explanation, columns: columns, pictures: pictures);
    switch (s.topic) {
      case Topic.counting:
        final a = pick(g == 1 ? 8 : 12);
        final b = pick(g == 1 ? 8 : 12);
        final shape = r.nextBool() ? 'circle' : 'square';
        return make('Count both groups. How many shapes altogether?',
          [...List.filled(a, shape), '+', ...List.filled(b, shape), '=', '?'],
          a + b, 'Count $a shapes in the first group and $b in the second. '
          '$a + $b = ${a + b}.', pictures: true);
      case Topic.sequence:
        final start = pick(g <= 2 ? 25 : 100);
        final step = pick(g <= 2 ? 3 : g * 3);
        final subtract = g >= 3 && r.nextBool();
        final first = subtract ? start + step * 4 : start;
        final delta = subtract ? -step : step;
        final missing = 1 + r.nextInt(4);
        final values = List.generate(5, (i) => first + delta * i);
        return make('Complete the number pattern.',
          List.generate(5, (i) => i == missing ? '?' : '${values[i]}'),
          values[missing], '${subtract ? "Subtract" : "Add"} $step each time. '
          'The missing number is ${values[missing]}.');
      case Topic.missingNumber:
        final a = pick(g <= 2 ? 20 : g * 35);
        final b = pick(g <= 2 ? 15 : g * 20);
        final multiply = g >= 3 && r.nextBool();
        final missingLeft = r.nextBool();
        final result = multiply ? a * b : a + b;
        return make('Find the missing number.',
          [missingLeft ? '?' : '$a', multiply ? 'x' : '+',
            missingLeft ? '$b' : '?', '=', '$result'],
          missingLeft ? a : b,
          multiply ? 'Divide $result by ${missingLeft ? b : a} to get ${missingLeft ? a : b}.'
          : 'Subtract ${missingLeft ? b : a} from $result to get ${missingLeft ? a : b}.');
      case Topic.numberMachine:
        final input = pick(g * 12);
        final factor = pick(g <= 2 ? 3 : 9);
        final offset = pick(g * 4);
        final multiply = g >= 3;
        final output = multiply ? input * factor + offset : input + offset;
        return make('Follow the machine from left to right.',
          ['$input', multiply ? 'x $factor' : '+ $offset',
            if (multiply) '+ $offset', '?'], output,
          multiply ? '$input x $factor = ${input * factor}; '
            '${input * factor} + $offset = $output.' : '$input + $offset = $output.');
      case Topic.fractions:
        final denominator = 2 + r.nextInt(g * 2);
        final numerator = pick(denominator - 1);
        final factor = 2 + r.nextInt(g);
        return make('Make the fractions equivalent. Find the missing numerator.',
          ['$numerator/$denominator', '=', '?/${denominator * factor}'],
          numerator * factor,
          'The denominator is multiplied by $factor. Multiply the numerator '
          'by $factor too: $numerator x $factor = ${numerator * factor}.');
      case Topic.grid:
        final rowStep = pick(g * 5), colStep = pick(g * 3);
        final start = pick(g * 15), hole = r.nextInt(9);
        final values = List.generate(9, (i) => start + (i ~/ 3) * rowStep + (i % 3) * colStep);
        return make('Complete the grid. Each row and column follows a pattern.',
          List.generate(9, (i) => i == hole ? '?' : '${values[i]}'), values[hole],
          'Add $colStep moving right and $rowStep moving down. '
          'The missing number is ${values[hole]}.', columns: 3);
    }
  }
}
