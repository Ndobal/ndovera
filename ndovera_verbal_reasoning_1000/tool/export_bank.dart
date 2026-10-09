import 'dart:convert';
import 'dart:io';
import '../lib/question_bank.dart';
void main() {
  final folder=Directory('exported_banks')..createSync(recursive:true);
  for(var grade=1;grade<=6;grade++) {
    final bank=StandardQuestionBank.forGrade(grade);
    File('${folder.path}/primary_$grade.json').writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert({
        'schemaVersion':1,'bankVersion':'vr1','grade':grade,
        'questions':bank.map((q)=>{'id':q.id,'topic':q.topic.name,
          'prompt':q.prompt,'tokens':q.tokens,'answer':q.answer,
          'explanation':q.explanation}).toList()}));
  }
  stdout.writeln('Exported six class banks of 1,000 questions each. Teacher-only data: includes answers.');
}
