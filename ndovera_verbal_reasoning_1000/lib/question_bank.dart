import 'dart:convert';
import 'dart:math';
import 'engine.dart';
import 'word_bank.dart';

/// Bank version is part of IDs: changing an item's meaning requires a new version.
class StandardQuestionBank {
  static final Map<int,List<Question>> _cache={};
  static List<Question> forGrade(int grade) {
    if(grade<1 || grade>6) throw ArgumentError('Primary class must be 1–6.');
    return _cache.putIfAbsent(grade,()=>_build(grade));
  }
  static List<Question> _build(int grade) {
    final result=<Question>[], ids=<String>{};
    void add(Topic topic,String identity,String prompt,List<String> tokens,
        String answer,String explanation) {
      final id='vr1:${base64Url.encode(utf8.encode('${topic.name}|$identity'))}';
      if(!ids.add(id)) throw StateError('Duplicate bank identity');
      if(tokens.where((t)=>t=='?').length!=1 || answer.isEmpty) {
        throw StateError('Invalid bank question');
      }
      result.add(Question(id:id,topic:topic,prompt:prompt,
        tokens:List.unmodifiable(tokens),answer:answer,explanation:explanation));
    }
    for(final w in wordBank.where((w)=>w.minGrade<=grade && w.maxGrade>=grade)) {
      add(w.topic,w.prompt,w.prompt,[...w.choices,'?'],w.answer,w.explanation);
    }
    final maxStep=grade<=2?1:grade<=4?2:3;
    for(var step=1;step<=maxStep;step++) {
      for(var start=0;start+4*step<26;start++) {
        for(var hole=0;hole<5;hole++) {
          final letters=List.generate(5,(i)=>String.fromCharCode(65+start+i*step));
          add(Topic.alphabet,'$step/$start/$hole',
            'Fill the missing letter. Follow the alphabet pattern.',
            List.generate(5,(i)=>i==hole?'?':letters[i]),letters[hole],
            'Move forward $step letter${step==1?"":"s"} each time. '
            'Complete pattern: ${letters.join(" ")}.');
        }
      }
    }
    if(grade>=4) {
      for(var shift=1;shift<=(grade<=4?1:3);shift++) {
        for(final raw in {...easyWords,...advancedWords}) {
          final word=raw.toUpperCase();
          String encode(String text)=>text.split('').map((c)=>String.fromCharCode(
            65+(c.codeUnitAt(0)-65+shift)%26)).join();
          add(Topic.letterCodes,'$word/$shift',
            'Move each letter forward $shift place${shift==1?"":"s"}. '
            'After Z, start again at A. Encode $word.',
            ['CAT',encode('CAT'),word,'?'],encode(word),
            word.split('').map((c)=>'$c becomes ${encode(c)}').join('; ')+'.');
        }
      }
    }
    // Each combination is a different word set. Permutations are NOT new questions.
    final words=List<String>.from(grade<=2?easyWords:advancedWords)..sort();
    final combinations=<List<String>>[];
    final length=grade<=2?3:4;
    void enumerate(int start,List<String> current) {
      if(current.length==length) { combinations.add(List.from(current)); return; }
      for(var i=start;i<=words.length-(length-current.length);i++) {
        current.add(words[i]); enumerate(i+1,current); current.removeLast();
      }
    }
    enumerate(0,[]);
    combinations.shuffle(Random(20261008+grade));
    for(final group in combinations) {
      if(result.length==1000) break;
      add(Topic.alphabeticalOrder,group.join('|'),
        'Which word comes first in alphabetical order?', [...group,'?'],group.first,
        'Compare letters from left to right. The order is ${group.join(", ")}.');
    }
    if(result.length!=1000) throw StateError('Class bank must contain exactly 1000 items.');
    return List.unmodifiable(result);
  }
}
