import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ndovera_verbal_reasoning/history.dart';
import 'package:ndovera_verbal_reasoning/engine.dart';
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('History persists, isolates classrooms and permits explicit revision reset', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences=await SharedPreferences.getInstance();
    final history=WorksheetHistory(preferences);
    final sheet=WorksheetEngine().generate(const WorksheetSettings(grade:1,topic:Topic.mixed));
    await history.reserve('class-A',sheet);
    final reloaded=WorksheetHistory(await SharedPreferences.getInstance());
    expect(reloaded.used('class-A',1).length,12);
    expect(reloaded.used('class-B',1),isEmpty);
    expect(reloaded.used('class-A',2),isEmpty);
    await reloaded.reset('class-A',1);
    expect(reloaded.used('class-A',1),isEmpty);
  });
}
