import 'dart:math';
import 'question_bank.dart';

enum WorksheetMode { assignment, practice, examination }
enum Topic { alphabet, alphabeticalOrder, opposites, synonyms, oddOneOut, analogies, letterCodes, mixed }
extension TopicLabel on Topic {
  String get label => const ['Alphabet patterns', 'Alphabetical order', 'Opposite words',
    'Words with similar meanings', 'Odd word out', 'Word relationships',
    'Letter codes', 'Mixed reasoning'][index];
}
List<Topic> topicsForGrade(int grade) => [Topic.alphabet, Topic.alphabeticalOrder,
  Topic.opposites, Topic.oddOneOut,
  if (grade >= 3) Topic.synonyms,
  if (grade >= 3) Topic.analogies,
  if (grade >= 4) Topic.letterCodes,
  Topic.mixed];
class WorksheetSettings {
  final int grade, count, examples, minutes, seed;
  final Topic topic;
  final WorksheetMode mode;
  final String title;
  const WorksheetSettings({required this.grade, required this.topic,
    this.count = 10, this.examples = 2, this.minutes = 30,
    this.seed = 1, this.mode = WorksheetMode.practice, this.title = 'Verbal Reasoning'});
  void validate() {
    if (grade < 1 || grade > 6 || count < 5 || count > 40 ||
      examples < 2 || examples > 3 || minutes < 5 || minutes > 180 ||
      title.trim().isEmpty || title.length > 100 || !topicsForGrade(grade).contains(topic)) {
      throw ArgumentError('Invalid class, topic or worksheet settings.');
    }
  }
  Map<String,dynamic> toJson() => {'subject':'verbal_reasoning','grade':grade,
    'topic':topic.name,'questionCount':count,'exampleCount':examples,
    'minutes':minutes,'seed':seed,'mode':mode.name,'title':title};
}
class Question {
  final String id, prompt, answer, explanation;
  final Topic topic;
  final List<String> tokens;
  final int columns;
  final bool pictures;
  const Question({required this.id, required this.prompt, required this.tokens,
    required this.answer, required this.explanation, this.columns=0, this.pictures=false, this.topic=Topic.alphabet});
  String get signature => '$prompt|${tokens.join(",")}';
}
class Worksheet {
  final WorksheetSettings settings;
  final List<Question> examples, questions;
  const Worksheet(this.settings,this.examples,this.questions);
}
class BankExhausted implements Exception {
  final int available, requested;
  const BankExhausted(this.available,this.requested);
  @override
  String toString()=> 'Only $available unused questions remain for this class/topic. '
    'This worksheet needs $requested including examples. Choose Mixed reasoning, '
    'a smaller worksheet, or explicitly clear the classroom history for revision.';
}
class WorksheetEngine {
  Worksheet generate(WorksheetSettings s, {Set<String> usedIds=const {}}) {
    s.validate();
    final bank=StandardQuestionBank.forGrade(s.grade);
    final eligible=bank.where((q)=>!usedIds.contains(q.id) &&
      (s.topic==Topic.mixed || q.topic==s.topic)).toList();
    final needed=s.count+s.examples;
    if(eligible.length<needed) throw BankExhausted(eligible.length,needed);
    final r=Random(s.seed);
    final groups=<Topic,List<Question>>{};
    for(final q in eligible) { groups.putIfAbsent(q.topic,()=>[]).add(q); }
    for(final group in groups.values) { group.shuffle(r); }
    final topics=groups.keys.toList()..shuffle(r);
    final chosen=<Question>[];
    // Round-robin topics prevents the larger ordering bank dominating mixed sheets.
    while(chosen.length<needed) {
      for(final topic in topics) {
        if(chosen.length==needed) break;
        final group=groups[topic]!;
        if(group.isNotEmpty) chosen.add(group.removeLast());
      }
    }
    final displayed=chosen.map((q) {
      final tokens=List<String>.from(q.tokens);
      if([Topic.alphabeticalOrder,Topic.opposites,Topic.synonyms,
          Topic.oddOneOut,Topic.analogies].contains(q.topic)) {
        tokens.remove('?'); tokens.shuffle(r); tokens.add('?');
      }
      return Question(id:q.id,prompt:q.prompt,tokens:List.unmodifiable(tokens),
        answer:q.answer,explanation:q.explanation,topic:q.topic);
    }).toList();
    return Worksheet(s,List.unmodifiable(displayed.take(s.examples)),
      List.unmodifiable(displayed.skip(s.examples)));
  }
}
