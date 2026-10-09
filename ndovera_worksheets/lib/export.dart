import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'engine.dart';

class WorksheetPdf {
  Future<Uint8List> build(Worksheet sheet, PdfPageFormat format,
      {bool answerKey = false}) async {
    final doc = pw.Document();
    final s = sheet.settings;
    pw.Widget visual(Question q, bool solved) {
      final cells = q.tokens.map((raw) {
        if (raw == 'circle' || raw == 'square') {
          return pw.Container(width: 14, height: 14,
            decoration: pw.BoxDecoration(color: PdfColors.blue800,
              shape: raw == 'circle' ? pw.BoxShape.circle : pw.BoxShape.rectangle));
        }
        return pw.Container(width: q.columns > 0 ? 48 : null,
          padding: const pw.EdgeInsets.all(7),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey500)),
          child: pw.Text(solved ? raw.replaceAll('?', '${q.answer}') : raw));
      }).toList();
      if (q.columns > 0) {
        return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          for (var i = 0; i < cells.length; i += q.columns)
            pw.Row(children: cells.sublist(i, i + q.columns))
        ]);
      }
      return pw.Wrap(spacing: 5, runSpacing: 5, children: cells);
    }
    pw.Widget block(Question q, String label, bool solved) => pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 16),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('$label. ${q.prompt}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8), visual(q, solved), pw.SizedBox(height: 8),
        if (solved) pw.Text(q.explanation)
        else pw.Text('Answer: ____________________     Working: ____________________'),
      ]));
    doc.addPage(pw.MultiPage(pageFormat: format,
      margin: const pw.EdgeInsets.all(32),
      footer: (c) => pw.Align(alignment: pw.Alignment.centerRight,
        child: pw.Text('Ndovera | ${c.pageNumber} / ${c.pagesCount}')),
      build: (context) => [
        pw.Text('${s.title}${answerKey ? " - Teacher answer key" : ""}',
          style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
        pw.Text('Primary ${s.grade} | ${s.topic.label} | ${s.mode.name} | ${s.minutes} minutes'),
        pw.SizedBox(height: 12),
        if (!answerKey) pw.Text('Name: _____________________  Class: __________  Date: __________'),
        pw.SizedBox(height: 12),
        if (!answerKey) ...[
          pw.Text('Study the worked examples, then answer the questions. Each question carries 1 mark.'),
          pw.SizedBox(height: 12),
          for (var i = 0; i < sheet.examples.length; i++) block(sheet.examples[i], 'Example ${i + 1}', true),
          pw.Text('Your turn', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 12),
        ],
        for (var i = 0; i < sheet.questions.length; i++) block(sheet.questions[i], '${i + 1}', answerKey),
      ]));
    return doc.save();
  }
}
