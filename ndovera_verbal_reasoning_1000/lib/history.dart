import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'engine.dart';

/// Device-local authoring history, not a server-wide or multi-device guarantee.
class WorksheetHistory {
  final SharedPreferences preferences;
  WorksheetHistory(this.preferences);
  String _key(String classroom,int grade) =>
    'ndovera.verbal.v1.${base64Url.encode(utf8.encode(classroom))}.primary$grade';
  Set<String> used(String classroom,int grade) =>
    (preferences.getStringList(_key(classroom,grade))??[]).toSet();
  Future<void> reserve(String classroom,Worksheet sheet) async {
    final values=used(classroom,sheet.settings.grade)
      ..addAll([...sheet.examples,...sheet.questions].map((q)=>q.id));
    final saved=await preferences.setStringList(_key(classroom,sheet.settings.grade),values.toList());
    if(!saved) throw StateError('Could not save usage history; worksheet was not displayed.');
  }
  Future<void> reset(String classroom,int grade) async {
    if(!await preferences.remove(_key(classroom,grade))) {
      throw StateError('Could not reset history.');
    }
  }
}
