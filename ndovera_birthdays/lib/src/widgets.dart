import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'api.dart';

/// The card (SVG) turned into a 1080 x 1350 PNG on this device, for saving or sharing.
Future<Uint8List> cardPng(Uint8List svg) async {
  final info = await vg.loadPicture(SvgBytesLoader(svg), null);
  try {
    final image = await info.picture.toImage(1080, 1350);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  } finally {
    info.picture.dispose();
  }
}

typedef SaveBirthdayCard = Future<void> Function(Uint8List bytes, String filename);

/// Embed in dashboards; memories=true embeds the user's own profile archive.
class BirthdayFeed extends StatefulWidget {
  final BirthdayApi api;
  final bool memories;
  final SaveBirthdayCard? onSaveCard;
  const BirthdayFeed({super.key, required this.api, this.memories = false, this.onSaveCard});
  @override
  State<BirthdayFeed> createState() => _BirthdayFeedState();
}
class _BirthdayFeedState extends State<BirthdayFeed> {
  late Future<List<Map<String, dynamic>>> _items;
  @override
  void initState() { super.initState(); _load(); }
  @override
  void didUpdateWidget(covariant BirthdayFeed oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.api != widget.api || oldWidget.memories != widget.memories) _load();
  }
  void _load() { _items = widget.api.list(memories: widget.memories); }
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    ListTile(leading: const Icon(Icons.cake_outlined),
      title: Text(widget.memories ? 'Birthday Memories' : 'Today’s Celebrations'),
      trailing: IconButton(tooltip: 'Refresh', onPressed: () => setState(_load), icon: const Icon(Icons.refresh))),
    FutureBuilder<List<Map<String, dynamic>>>(future: _items, builder: (context, snapshot) {
      if (snapshot.hasError) return _ErrorView(onRetry: () => setState(_load));
      if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
      if (snapshot.data!.isEmpty) return Padding(padding: const EdgeInsets.all(24),
        child: Text(widget.memories ? 'Your birthday memories will appear here.' : 'No birthday celebrations today.'));
      return Column(children: snapshot.data!.map((item) => Card(
        clipBehavior: Clip.antiAlias,
        child: ListTile(contentPadding: const EdgeInsets.all(20),
          leading: const CircleAvatar(child: Icon(Icons.celebration)),
          title: Text(item['name'] as String),
          subtitle: Text(item['displayDate'] as String),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BirthdayCelebrationPage(
            api: widget.api, celebrationId: item['id'] as String, onSaveCard: widget.onSaveCard)))),
      )).toList());
    }),
  ]);
}

class BirthdayCelebrationPage extends StatefulWidget {
  final BirthdayApi api;
  final String celebrationId;
  final SaveBirthdayCard? onSaveCard;
  const BirthdayCelebrationPage({super.key, required this.api, required this.celebrationId, this.onSaveCard});
  @override
  State<BirthdayCelebrationPage> createState() => _BirthdayCelebrationPageState();
}
class _BirthdayCelebrationPageState extends State<BirthdayCelebrationPage> {
  late Future<Map<String, dynamic>> _record;
  late Future<Uint8List> _card;
  final _message = TextEditingController();
  String _style = 'cheerful';
  String? _requestId;
  bool _busy = false;
  @override
  void initState() { super.initState(); _load(); }
  void _load() {
    _record = widget.api.celebration(widget.celebrationId);
    _card = widget.api.card(widget.celebrationId);
  }
  @override
  void dispose() { _message.dispose(); super.dispose(); }
  Future<void> _action(Future<void> Function() action) async {
    setState(() => _busy = true);
    try { await action(); }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action failed. Please try again.'))); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _send() async {
    final text = _message.text.trim();
    if (text.isEmpty || text.length > 1000) return;
    final approved = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Preview birthday wish'), content: Text(text), actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Edit')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Send')),
      ]));
    if (approved != true || !mounted) return;
    await _action(() async {
      _requestId ??= '${DateTime.now().microsecondsSinceEpoch}-${widget.celebrationId}';
      await widget.api.wish(widget.celebrationId, text, _requestId!);
      _message.clear(); _requestId = null;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Wish submitted. It may require moderation.')));
        setState(_load);
      }
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Birthday Celebration')),
    body: FutureBuilder<Map<String, dynamic>>(future: _record, builder: (context, snapshot) {
      if (snapshot.hasError) return _ErrorView(onRetry: () => setState(_load));
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      final data = snapshot.data!;
      return SingleChildScrollView(padding: const EdgeInsets.all(20), child: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Happy Birthday, ${data['name']}!', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 16),
          FutureBuilder<Uint8List>(future: _card, builder: (context, image) {
            if (image.hasError) return _ErrorView(onRetry: () => setState(() { _card = widget.api.card(widget.celebrationId); }));
            if (!image.hasData) return const SizedBox(height: 300, child: Center(child: CircularProgressIndicator()));
            return ClipRRect(borderRadius: BorderRadius.circular(24), child: AspectRatio(aspectRatio: 1080 / 1350,
              child: SvgPicture.memory(image.data!, fit: BoxFit.contain,
                semanticsLabel: 'Personalised birthday card for ${data['name']}',
                errorBuilder: (_, __, ___) => const Text('Card image unavailable.'))));
          }),
          const SizedBox(height: 16), Text(data['message'] as String),
          if (widget.onSaveCard != null) TextButton.icon(onPressed: _busy ? null : () => _action(() async {
            await widget.onSaveCard!(await cardPng(await _card), 'birthday-${widget.celebrationId}.png');
          }), icon: const Icon(Icons.download), label: const Text('Save card')),
          if (data['canSendWish'] == true) ...[
            const SizedBox(height: 24), TextField(controller: _message, maxLength: 1000, minLines: 3, maxLines: 6,
              enabled: !_busy, onChanged: (_) => _requestId = null,
              decoration: const InputDecoration(labelText: 'Your birthday wish', border: OutlineInputBorder())),
            DropdownButtonFormField<String>(initialValue: _style, decoration: const InputDecoration(labelText: 'Message style'),
              items: (data['allowedStyles'] as List).cast<String>().map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: _busy ? null : (value) => setState(() => _style = value ?? 'cheerful')),
            Wrap(spacing: 12, children: [
              TextButton(onPressed: _busy ? null : () => _action(() async {
                final suggestion = await widget.api.suggest(widget.celebrationId, _style);
                if (mounted) { _message.text = suggestion; _requestId = null; }
              }), child: const Text('Help me write')),
              FilledButton(onPressed: _busy ? null : _send, child: const Text('Preview & send')),
            ]),
          ],
          if (_busy) const LinearProgressIndicator(),
          Text('${data['wishCount']} birthday wishes'),
          if (data['canReadWishes'] == true) BirthdayWishes(api: widget.api,
            celebrationId: widget.celebrationId),
        ]))));
    }));
}

class BirthdayWishes extends StatefulWidget {
  final BirthdayApi api;
  final String celebrationId;
  const BirthdayWishes({super.key, required this.api, required this.celebrationId});
  @override
  State<BirthdayWishes> createState() => _BirthdayWishesState();
}
class _BirthdayWishesState extends State<BirthdayWishes> {
  late Future<List<Map<String, dynamic>>> _future;
  @override
  void initState() { super.initState(); _future = widget.api.wishes(widget.celebrationId); }
  @override
  Widget build(BuildContext context) => FutureBuilder<List<Map<String, dynamic>>>(future: _future, builder: (context, snapshot) {
    if (snapshot.hasError) return _ErrorView(onRetry: () => setState(() => _future = widget.api.wishes(widget.celebrationId)));
    if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
    return Column(children: snapshot.data!.map((wish) => ListTile(
      title: Text(wish['senderName'] as String), subtitle: Text(wish['message'] as String),
      trailing: IconButton(tooltip: 'Report wish', icon: const Icon(Icons.flag_outlined), onPressed: () async {
        final reason = TextEditingController();
        final text = await showDialog<String>(context: context, builder: (context) => AlertDialog(
          title: const Text('Report birthday wish'), content: TextField(controller: reason, maxLength: 500),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            FilledButton(onPressed: () { if (reason.text.trim().isNotEmpty) Navigator.pop(context, reason.text.trim()); }, child: const Text('Report'))]));
        reason.dispose();
        if (text == null) return;
        try { await widget.api.report(widget.celebrationId, wish['id'] as String, text); }
        catch (_) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Report failed. Try again.'))); }
      }),
    )).toList());
  });
}

class BirthdaySettingsPage extends StatefulWidget {
  final BirthdayApi api;
  const BirthdaySettingsPage({super.key, required this.api});
  @override
  State<BirthdaySettingsPage> createState() => _BirthdaySettingsPageState();
}
class _BirthdaySettingsPageState extends State<BirthdaySettingsPage> {
  Map<String, dynamic>? _settings;
  bool _failed = false, _saving = false;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try { final value = await widget.api.settings(); if (mounted) setState(() { _settings = value; _failed = false; }); }
    catch (_) { if (mounted) setState(() => _failed = true); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Birthday Service Settings')),
    body: _failed ? _ErrorView(onRetry: _load) : _settings == null ? const Center(child: CircularProgressIndicator()) :
    ListView(padding: const EdgeInsets.all(20), children: [
      for (final entry in const {'enabled': 'Automatic celebrations', 'students': 'Celebrate students',
        'staff': 'Celebrate staff', 'wishes': 'Allow birthday wishes', 'aiCards': 'Ndovera AI writes the card message',
        'moderateStudentWishes': "Check students' wishes first", 'faithStyles': 'Offer wishes with a blessing'}.entries)
        SwitchListTile(title: Text(entry.value), value: _settings![entry.key] == true,
          onChanged: _saving ? null : (v) => setState(() => _settings![entry.key] = v)),
      Text('School timezone: ${_settings!['timezone']}'),
      ListTile(title: const Text('Daily announcement time'), subtitle: Text(_settings!['announcementTime'] as String),
        onTap: _saving ? null : () async {
          final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 7, minute: 0));
          if (time != null && mounted) setState(() => _settings!['announcementTime'] = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}');
        }),
      DropdownButtonFormField<String>(initialValue: _settings!['leapDayPolicy'] as String,
        decoration: const InputDecoration(labelText: '29 February in non-leap years'),
        items: const [DropdownMenuItem(value: 'feb28', child: Text('28 February')), DropdownMenuItem(value: 'mar01', child: Text('1 March'))],
        onChanged: _saving ? null : (v) => setState(() => _settings!['leapDayPolicy'] = v)),
      const SizedBox(height: 20), FilledButton(onPressed: _saving ? null : () async {
        setState(() => _saving = true);
        try { await widget.api.saveSettings(Map<String, dynamic>.from(_settings!));
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Settings saved.')));
        } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to save. Refresh and try again.'))); }
        finally { if (mounted) setState(() => _saving = false); }
      }, child: Text(_saving ? 'Saving…' : 'Save settings')),
    ]));
}
/// Whether to be celebrated: staff opt out, students (and parents for their children) opt in.
class BirthdayConsentPage extends StatefulWidget {
  final BirthdayApi api;
  const BirthdayConsentPage({super.key, required this.api});
  @override
  State<BirthdayConsentPage> createState() => _BirthdayConsentPageState();
}
class _BirthdayConsentPageState extends State<BirthdayConsentPage> {
  Map<String, dynamic>? _data;
  bool _failed = false;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try { final value = await widget.api.myConsent(); if (mounted) setState(() { _data = value; _failed = false; }); }
    catch (_) { if (mounted) setState(() => _failed = true); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('My birthday choice')),
    body: _failed ? _ErrorView(onRetry: _load) : _data == null ? const Center(child: CircularProgressIndicator()) : ListView(padding: const EdgeInsets.all(20), children: [
      if (_data!['kind'] == 'staff' || _data!['kind'] == 'student')
        SwitchListTile(title: const Text('Celebrate my birthday at school'), subtitle: const Text('Your name, photo and day, never your age.'),
          value: _data!['celebrate'] == true, onChanged: (v) async { await widget.api.setMyConsent(v); await _load(); }),
      for (final child in ((_data!['children'] as List?) ?? []).cast<Map>())
        SwitchListTile(title: Text("Celebrate ${child['name']}'s birthday"), value: child['celebrate'] == true,
          onChanged: (v) async { await widget.api.setChildConsent(child['id'].toString(), v); await _load(); }),
      const Padding(padding: EdgeInsets.only(top: 12), child: Text("Turning this off removes today's celebration straight away.")),
    ]));
}

/// Owner / Head of School: wishes waiting for review (students' wishes, reported wishes).
class BirthdayModerationPage extends StatefulWidget {
  final BirthdayApi api;
  const BirthdayModerationPage({super.key, required this.api});
  @override
  State<BirthdayModerationPage> createState() => _BirthdayModerationPageState();
}
class _BirthdayModerationPageState extends State<BirthdayModerationPage> {
  late Future<List<Map<String, dynamic>>> _items;
  @override
  void initState() { super.initState(); _items = widget.api.moderation(); }
  void _reload() => setState(() => _items = widget.api.moderation());
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Review birthday wishes')),
    body: FutureBuilder<List<Map<String, dynamic>>>(future: _items, builder: (context, snapshot) {
      if (snapshot.hasError) return _ErrorView(onRetry: _reload);
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      if (snapshot.data!.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Text('No wishes waiting for review.'));
      return ListView(children: snapshot.data!.map((wish) {
        final reason = (wish['reportReason'] ?? '').toString();
        return ListTile(
          title: Text('${wish['senderName']} to ${wish['recipient']}'),
          subtitle: Text(reason.isEmpty ? '${wish['message']}' : '${wish['message']}\nReported: $reason'),
          trailing: Wrap(spacing: 4, children: [
            IconButton(tooltip: 'Approve', icon: const Icon(Icons.check), onPressed: () async { await widget.api.decide(wish['id'] as String, true); _reload(); }),
            IconButton(tooltip: 'Reject', icon: const Icon(Icons.close), onPressed: () async { await widget.api.decide(wish['id'] as String, false); _reload(); }),
          ]));
      }).toList());
    }));
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Text('Unable to load. Check your connection or school access.'),
    TextButton(onPressed: onRetry, child: const Text('Try again')),
  ]));
}
