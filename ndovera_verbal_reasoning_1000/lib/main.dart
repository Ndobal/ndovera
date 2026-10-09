import 'dart:math';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'engine.dart';
import 'export.dart';
import 'visual.dart';
import 'history.dart';
import 'question_bank.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() => runApp(const NdoveraWorksheets());
class NdoveraWorksheets extends StatelessWidget {
  const NdoveraWorksheets({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Ndovera Worksheets', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff2859a5)),
      scaffoldBackgroundColor: const Color(0xfff4f6fb)),
    home: const WorksheetStudio());
}

/// Teacher authoring screen. Mount only inside your authenticated teacher route.
class WorksheetStudio extends StatefulWidget {
  final String classroomId;
  const WorksheetStudio({super.key, this.classroomId='local-authoring'});
  @override
  State<WorksheetStudio> createState() => _WorksheetStudioState();
}
class _WorksheetStudioState extends State<WorksheetStudio> {
  final title = TextEditingController(text: 'Verbal Reasoning');
  int grade = 1, count = 10, examples = 2, minutes = 30;
  Topic topic = Topic.alphabet;
  WorksheetMode mode = WorksheetMode.practice;
  Worksheet? sheet;
  bool busy = false;
  WorksheetHistory? history;
  String? historyError;
  @override
  void initState() { super.initState(); loadHistory(); }
  Future<void> loadHistory() async {
    try {
      final prefs=await SharedPreferences.getInstance();
      if(mounted) setState(()=>history=WorksheetHistory(prefs));
    } catch (_) { if(mounted) setState(()=>historyError="History could not load. Restart before generating."); }
  }
  @override
  void dispose() { title.dispose(); super.dispose(); }
  Future<void> generate() async {
    if(busy || history==null) return;
    setState(()=>busy=true);
    FocusScope.of(context).unfocus();
    try {
      final result = WorksheetEngine().generate(WorksheetSettings(
        grade: grade, topic: topic, count: count, examples: examples,
        minutes: minutes, title: title.text.trim(), mode: mode,
        seed: Random.secure().nextInt(1 << 30)),
        usedIds:history!.used(widget.classroomId,grade));
      await history!.reserve(widget.classroomId,result);
      if(!mounted) return;
      setState(() => sheet = result);
    } catch (e) { if(mounted) message(e.toString()); }
    finally { if(mounted) setState(()=>busy=false); }
  }
  void message(String text) => ScaffoldMessenger.of(context)
    .showSnackBar(SnackBar(content: Text(text)));
  Future<void> printSheet(bool key) async {
    final current = sheet;
    if (current == null || busy) return;
    setState(() => busy = true);
    try {
      await Printing.layoutPdf(name: key ? 'ndovera-answer-key' : 'ndovera-worksheet',
        onLayout: (format) => WorksheetPdf().build(current, format, answerKey: key));
    } catch (_) {
      if (mounted) message('Could not open printing. Please try again.');
    } finally { if (mounted) setState(() => busy = false); }
  }
  Future<void> resetHistory() async {
    final currentGrade=grade;
    final confirmed=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(
      title:const Text('Allow previously used questions again?'),
      content:Text('This clears device history for Primary $currentGrade in this classroom. Future worksheets may repeat previous items.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Clear for revision'))]));
    if(confirmed!=true || !mounted) return;
    setState(()=>busy=true);
    try { await history!.reset(widget.classroomId,currentGrade); }
    catch(e) { if(mounted) message(e.toString()); }
    finally { if(mounted) setState(()=>busy=false); }
  }
  Widget select<T>(String label, T value, List<T> values,
      String Function(T) caption, void Function(T) change) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: DropdownButtonFormField<T>(value: value,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      items: values.map((v) => DropdownMenuItem(value: v, child: Text(caption(v)))).toList(),
      onChanged: busy ? null : (v) { if (v != null) setState(() => change(v)); }));
  Widget controls() => Card(child: Padding(padding: const EdgeInsets.all(20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Create a worksheet', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
      const SizedBox(height: 16),
      TextField(controller: title, maxLength: 100,
        decoration: const InputDecoration(labelText: 'Worksheet title', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      select('Class', grade, [1, 2, 3, 4, 5, 6], (v) => 'Primary $v', (v) {
        grade = v;
        if (!topicsForGrade(v).contains(topic)) topic = topicsForGrade(v).first;
      }),
      select('Topic', topic, topicsForGrade(grade), (v) => v.label, (v) => topic = v),
      select('Purpose', mode, WorksheetMode.values, (v) => v.name, (v) => mode = v),
      select('Worked examples', examples, [2, 3], (v) => '$v examples', (v) => examples = v),
      select('Questions', count, [5, 10, 15, 20, 30, 40], (v) => '$v questions', (v) => count = v),
      select('Duration', minutes, [15, 30, 45, 60, 90], (v) => '$v minutes', (v) => minutes = v),
      FilledButton.icon(onPressed: busy || history==null ? null : generate,
        icon: const Icon(Icons.auto_awesome), label: const Text('Generate worksheet')),
      const SizedBox(height: 8),
      Text(historyError ?? '${StandardQuestionBank.forGrade(grade).where((q)=> topic==Topic.mixed || q.topic==topic).where((q)=> !(history?.used(widget.classroomId,grade).contains(q.id) ?? false)).length} unused items for this class/topic'),
      TextButton(onPressed:busy || history==null ? null : resetHistory, child:const Text('Clear class history for revision')),
      const Text('Original word puzzles with class-based difficulty. The current preview stays unchanged until you generate again.',
        style: TextStyle(fontSize: 12)),
    ])));
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ndovera • Worksheet Studio')),
    body: LayoutBuilder(builder: (context, constraints) {
      final preview = sheet == null ? const Card(child: Padding(
        padding: EdgeInsets.all(40), child: Column(children: [
          Icon(Icons.extension_outlined, size: 64), SizedBox(height: 16),
          Text('Choose a class and topic to create your first worksheet.')
        ]))) : TeacherPreview(sheet: sheet!);
      if (constraints.maxWidth < 900) {
        return ListView(padding: const EdgeInsets.all(12), children: [controls(), actions(), preview]);
      }
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 340, child: SingleChildScrollView(padding: const EdgeInsets.all(12), child: controls())),
        Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [actions(), preview])),
      ]);
    }));
  Widget actions() => Padding(padding: const EdgeInsets.symmetric(vertical: 8),
    child: Wrap(spacing: 10, runSpacing: 8, children: [
      OutlinedButton.icon(onPressed: sheet == null || busy ? null : () => printSheet(false),
        icon: const Icon(Icons.print), label: const Text('Print / save student PDF')),
      OutlinedButton.icon(onPressed: sheet == null || busy ? null : () => printSheet(true),
        icon: const Icon(Icons.key), label: const Text('Teacher answer key')),
      if (busy) const SizedBox(width: 24, height: 24, child: CircularProgressIndicator()),
    ]));
}

class TeacherPreview extends StatelessWidget {
  final Worksheet sheet;
  const TeacherPreview({super.key, required this.sheet});
  @override
  Widget build(BuildContext context) => Card(child: Padding(
    padding: const EdgeInsets.all(24), child: Column(
      crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(sheet.settings.title, style: Theme.of(context).textTheme.headlineSmall),
        Text('Primary ${sheet.settings.grade} • ${sheet.settings.topic.label} • ${sheet.settings.mode.name}'),
        Text('${sheet.questions.length} marks • ${sheet.settings.minutes} minutes'),
        const Divider(height: 32),
        const Text('Worked examples', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        for (var i = 0; i < sheet.examples.length; i++) item(sheet.examples[i], 'Example ${i + 1}', true),
        const Divider(height: 32),
        const Text('Your turn', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        for (var i = 0; i < sheet.questions.length; i++) item(sheet.questions[i], '${i + 1}', false),
      ])));
  Widget item(Question q, String label, bool solved) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 14), child: Column(
      crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$label. ${q.prompt}', style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 10), QuestionVisual(question: q, solved: solved),
        const SizedBox(height: 10),
        if (solved) Text(q.explanation)
        else const Text('Answer: ____________________     Working: ____________________'),
      ]));
}
