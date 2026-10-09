import 'package:flutter_test/flutter_test.dart';
import 'package:ndovera_verbal_reasoning/engine.dart';
import 'package:ndovera_verbal_reasoning/word_bank.dart';
import 'package:ndovera_verbal_reasoning/question_bank.dart';
void main() {
  test('Every class has 1000 stable unique bank identities', () {
    for(var grade=1;grade<=6;grade++) {
      final bank=StandardQuestionBank.forGrade(grade);
      expect(bank.length,1000);
      expect(bank.map((q)=>q.id).toSet().length,1000);
      expect(bank.every((q)=>topicsForGrade(grade).contains(q.topic)),isTrue);
    }
  });
  test('Consecutive generations never reuse exercises or examples', () {
    final used=<String>{};
    for(var seed=0;seed<20;seed++) {
      final sheet=WorksheetEngine().generate(WorksheetSettings(
        grade:5,topic:Topic.mixed,count:40,examples:3,seed:seed),usedIds:used);
      for(final q in [...sheet.examples,...sheet.questions]) {
        expect(used.add(q.id),isTrue);
      }
    }
    expect(used.length,860);
  });
  test('Exhausted topic raises instead of silently recycling questions', () {
    final used=StandardQuestionBank.forGrade(1)
      .where((q)=>q.topic==Topic.opposites).map((q)=>q.id).toSet();
    expect(()=>WorksheetEngine().generate(const WorksheetSettings(
      grade:1,topic:Topic.opposites),usedIds:used),throwsA(isA<BankExhausted>()));
  });
  test('Every class/topic generates 10 distinct questions and 3 examples', () {
    for(var grade=1;grade<=6;grade++) {
      for(final topic in topicsForGrade(grade)) {
        for(var seed=0;seed<20;seed++) {
          final sheet=WorksheetEngine().generate(WorksheetSettings(
            grade:grade,topic:topic,count:10,examples:3,seed:seed));
          final all=[...sheet.examples,...sheet.questions];
          expect(all.length,13);
          expect(all.map((q)=>q.signature).toSet().length,13);
          for(final q in all) {
            expect(q.tokens.where((t)=>t=='?').length,1);
            expect(q.answer,isNotEmpty);
            expect(q.explanation,isNotEmpty);
          }
        }
      }
    }
  });
  test('Vocabulary items have exactly one correct choice', () {
    for(final q in wordBank) {
      expect(q.choices.where((c)=>c==q.answer).length,1);
      expect(q.choices.toSet().length,q.choices.length);
    }
  });
  test('Alphabet order is correct', () {
    final sheet=WorksheetEngine().generate(const WorksheetSettings(
      grade:6,topic:Topic.alphabeticalOrder));
    for(final q in [...sheet.examples,...sheet.questions]) {
      final sorted=q.tokens.where((t)=>t!='?').toList()..sort();
      expect(q.answer,sorted.first);
    }
  });
  test('Patterns follow their constant letter step', () {
    final sheet=WorksheetEngine().generate(const WorksheetSettings(grade:6,topic:Topic.alphabet));
    for(final q in [...sheet.examples,...sheet.questions]) {
      final values=q.tokens.map((t)=>(t=='?'?q.answer:t).codeUnitAt(0)).toList();
      for(var i=2;i<values.length;i++) {
        expect(values[i]-values[i-1],values[1]-values[0]);
      }
    }
  });
  test('Letter codes wrap around alphabet', () {
    for(var seed=0;seed<20;seed++) {
      final sheet=WorksheetEngine().generate(WorksheetSettings(grade:6,topic:Topic.letterCodes,seed:seed));
      for(final q in [...sheet.examples,...sheet.questions]) {
        final shift=q.tokens[1].codeUnitAt(0)-'C'.codeUnitAt(0);
        final source=q.tokens[2];
        final expected=source.split('').map((c)=>String.fromCharCode(
          65+(c.codeUnitAt(0)-65+shift)%26)).join();
        expect(q.answer,expected);
      }
    }
  });
  test('Reject invalid class/topic combinations', () {
    expect(()=>WorksheetEngine().generate(const WorksheetSettings(
      grade:1,topic:Topic.letterCodes)),throwsArgumentError);
  });
  test('Same seed reproduces item selection and choice order', () {
    const s=WorksheetSettings(grade:5,topic:Topic.mixed,seed:83);
    expect(WorksheetEngine().generate(s).questions.map((q)=>q.signature),
      WorksheetEngine().generate(s).questions.map((q)=>q.signature));
  });
}
