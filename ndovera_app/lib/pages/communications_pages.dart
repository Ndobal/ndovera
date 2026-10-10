import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/communications_service.dart';
import '../theme/brand.dart';

/// Parent notifications (N20) in the app: the school's Notifications screen, the parent's
/// inbox and choices, and Super Admin → Communications. Same API as the web app.

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2, color: Brand.maroonDeep)),
            const SizedBox(height: 8),
            child,
          ]),
        ),
      );
}

void _snack(BuildContext context, String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

// ─── School: Notifications ──────────────────────────────────────────────────

class SchoolNotificationsPage extends StatefulWidget {
  const SchoolNotificationsPage({super.key, this.service});
  final CommunicationsService? service;
  @override
  State<SchoolNotificationsPage> createState() => _SchoolNotificationsPageState();
}

class _SchoolNotificationsPageState extends State<SchoolNotificationsPage> {
  late final CommunicationsService _service = widget.service ?? CommunicationsService();
  CommOverview? _data;
  String? _error;
  String _channel = 'whatsapp';
  int _units = 100;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _service.overview();
      if (mounted) setState(() { _data = data; _error = null; });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _setPolicy(String policy) async {
    final data = _data!;
    var acknowledge = false;
    if (policy == 'SMS_FOR_REMAINDER') {
      acknowledge = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Use SMS for the rest?'),
              content: Text('Parents WhatsApp units cannot cover will get SMS, at ${naira(data.prices['sms'] ?? 800)} per SMS segment, from your SMS units. If SMS units cannot cover everyone left, the send waits.'),
              actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm'))],
            ),
          ) ??
          false;
      if (!acknowledge) return;
    }
    try {
      await _service.saveSettings({'shortagePolicy': policy, 'acknowledgeSmsCost': acknowledge});
      await _load();
    } catch (error) {
      if (mounted) _snack(context, error.toString());
    }
  }

  Future<void> _buy() async {
    try {
      final url = await _service.buy(_channel, _units);
      if (url.isNotEmpty) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (error) {
      if (mounted) _snack(context, error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(title: const Text('Parent notifications'), actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh), tooltip: 'Refresh')]),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(color: Colors.red))))
          : data == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    for (final warning in data.warnings)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.amber.shade50, border: Border.all(color: Colors.amber.shade300), borderRadius: BorderRadius.circular(12)),
                        child: Text(warning, style: TextStyle(color: Colors.amber.shade900, fontWeight: FontWeight.w600)),
                      ),
                    _Section(
                      title: 'Units',
                      child: Wrap(spacing: 12, runSpacing: 12, children: [
                        for (final channel in ['whatsapp', 'sms', 'email'])
                          SizedBox(
                            width: 150,
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(channelLabels[channel]!, style: const TextStyle(fontWeight: FontWeight.bold, color: Brand.navy)),
                              Text(channel == 'email' && data.prices['email'] == 0 ? 'Free' : '${data.wallets[channel]!.spendable}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Brand.maroon)),
                              if (!(channel == 'email' && data.prices['email'] == 0)) Text('${data.wallets[channel]!.reserved} reserved · ${data.wallets[channel]!.used} used', style: const TextStyle(fontSize: 12)),
                              if (channel != 'email') Text('${naira(data.prices[channel] ?? 0)} per ${channel == 'sms' ? 'segment' : 'message'}', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                              if ((data.paused[channel] ?? []).isNotEmpty) const Text('Paused: waiting for units', style: TextStyle(fontSize: 12, color: Colors.orange)),
                            ]),
                          ),
                      ]),
                    ),
                    _Section(
                      title: 'Waiting for units (${data.waiting.length})',
                      child: data.waiting.isEmpty
                          ? const Text('Nothing is waiting.')
                          : Column(children: [
                              for (final batch in data.waiting)
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(batch.label),
                                  subtitle: Text('${batch.families} families · short ${batch.shortfall.entries.map((e) => '${e.value} ${channelLabels[e.key]}').join(', ')}'),
                                  trailing: OutlinedButton(onPressed: () async { await _service.recheckBatch(batch.id); await _load(); }, child: const Text('Check again')),
                                ),
                            ]),
                    ),
                    _Section(
                      title: 'When WhatsApp units run short',
                      child: RadioGroup<String>(
                        groupValue: data.policy,
                        onChanged: (value) { if (data.canChangeSettings && value != null) _setPolicy(value); },
                        child: Column(children: [
                          RadioListTile<String>(
                            contentPadding: EdgeInsets.zero,
                            value: 'PAUSE_BATCH',
                            enabled: data.canChangeSettings,
                            title: const Text('Pause the whole WhatsApp send until you add units'),
                            subtitle: const Text('Email and in-app still go.'),
                          ),
                          RadioListTile<String>(
                            contentPadding: EdgeInsets.zero,
                            value: 'SMS_FOR_REMAINDER',
                            enabled: data.canChangeSettings,
                            title: const Text('WhatsApp first, SMS for the rest'),
                            subtitle: Text('Uses SMS units (${naira(data.prices['sms'] ?? 800)} per segment).'),
                          ),
                        ]),
                      ),
                    ),
                    if (data.canBuy)
                      _Section(
                        title: 'Buy units',
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SegmentedButton<String>(
                            segments: const [ButtonSegment(value: 'whatsapp', label: Text('WhatsApp')), ButtonSegment(value: 'sms', label: Text('SMS'))],
                            selected: {_channel},
                            onSelectionChanged: (value) => setState(() => _channel = value.first),
                          ),
                          const SizedBox(height: 8),
                          Wrap(spacing: 8, children: [
                            for (final size in data.packages)
                              ChoiceChip(label: Text('$size · ${naira(size * (data.prices[_channel] ?? 0))}'), selected: _units == size, onSelected: (_) => setState(() => _units = size)),
                          ]),
                          const SizedBox(height: 8),
                          Text('Total ${naira(_units * (data.prices[_channel] ?? 0))}. Bought units never expire. A message the provider accepts uses its units even if the phone is off.', style: const TextStyle(fontSize: 12)),
                          const SizedBox(height: 8),
                          FilledButton(onPressed: _buy, style: FilledButton.styleFrom(backgroundColor: Brand.forest), child: const Text('Pay with Flutterwave')),
                        ]),
                      ),
                  ]),
                ),
    );
  }
}

// ─── Parent: notifications and choices ─────────────────────────────────────

class ParentNotificationsPage extends StatefulWidget {
  const ParentNotificationsPage({super.key, this.service});
  final CommunicationsService? service;
  @override
  State<ParentNotificationsPage> createState() => _ParentNotificationsPageState();
}

class _ParentNotificationsPageState extends State<ParentNotificationsPage> {
  late final CommunicationsService _service = widget.service ?? CommunicationsService();
  List<InboxItem> _items = [];
  Map<String, String> _choices = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _service.inbox();
      final choices = await _service.myChoices();
      if (!mounted) return;
      setState(() { _items = items; _choices = choices; _loading = false; });
      if (items.any((item) => !item.read)) await _service.markAllRead();
    } catch (error) {
      if (mounted) { setState(() => _loading = false); _snack(context, error.toString()); }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  if (_items.isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('No notifications yet.')),
                  for (final item in _items)
                    Card(
                      color: item.read ? null : const Color(0xFFE8F5EE),
                      child: ListTile(
                        title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold, color: Brand.maroon)),
                        subtitle: Text(item.body),
                        onTap: item.link.isEmpty ? null : () => launchUrl(Uri.parse(item.link)),
                      ),
                    ),
                  const SizedBox(height: 12),
                  _Section(
                    title: 'How the school may contact you',
                    child: Column(children: [
                      for (final channel in ['whatsapp', 'sms', 'email'])
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(channelLabels[channel]!),
                          subtitle: _choices[channel] == 'not set' ? const Text('Not set') : null,
                          value: _choices[channel] == 'granted',
                          onChanged: (on) async {
                            await _service.setChoice(channel, on ? 'granted' : 'withdrawn');
                            setState(() => _choices[channel] = on ? 'granted' : 'withdrawn');
                          },
                        ),
                    ]),
                  ),
                ]),
              ),
      );
}

// ─── Super Admin: Communications ───────────────────────────────────────────

class SuperAdminCommunicationsPage extends StatefulWidget {
  const SuperAdminCommunicationsPage({super.key, this.service});
  final CommunicationsService? service;
  @override
  State<SuperAdminCommunicationsPage> createState() => _SuperAdminCommunicationsPageState();
}

class _SuperAdminCommunicationsPageState extends State<SuperAdminCommunicationsPage> {
  late final CommunicationsService _service = widget.service ?? CommunicationsService();
  List<SchoolWallet> _schools = [];
  List<Map<String, dynamic>> _templates = [];
  List<Map<String, dynamic>> _unknown = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final schools = await _service.schoolWallets();
      final templates = await _service.templates();
      final unknown = await _service.unknownDeliveries();
      if (mounted) setState(() { _schools = schools; _templates = templates; _unknown = unknown; });
    } catch (error) {
      if (mounted) _snack(context, error.toString());
    }
  }

  Future<void> _allocate(SchoolWallet school) async {
    var channel = 'whatsapp';
    final units = TextEditingController(text: '50');
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: Text('Free units for ${school.name}'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButton<String>(value: channel, items: const [DropdownMenuItem(value: 'whatsapp', child: Text('WhatsApp')), DropdownMenuItem(value: 'sms', child: Text('SMS'))], onChanged: (value) => setDialog(() => channel = value!)),
            TextField(controller: units, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Units')),
            TextField(controller: reason, decoration: const InputDecoration(labelText: 'Reason (required)')),
          ]),
          actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Review'))],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    final count = int.tryParse(units.text) ?? 0;
    final review = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm allocation'),
        content: Text('Give $count ${channelLabels[channel]} units to ${school.name}.\nReason: ${reason.text}'),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Change')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Allocate'))],
      ),
    );
    if (review != true) return;
    try {
      await _service.gift(tenantIds: [school.id], channel: channel, units: count, reason: reason.text, idempotencyKey: 'app-${DateTime.now().microsecondsSinceEpoch}');
      await _load();
      if (mounted) _snack(context, 'Units allocated.');
    } catch (error) {
      if (mounted) _snack(context, error.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Communications')),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            _Section(
              title: 'School wallets',
              child: Column(children: [
                for (final school in _schools)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(school.name),
                    subtitle: Text('WhatsApp ${school.whatsapp.spendable} · SMS ${school.sms.spendable} · used ${school.whatsapp.used + school.sms.used}'),
                    trailing: OutlinedButton(onPressed: () => _allocate(school), child: const Text('Give units')),
                  ),
              ]),
            ),
            _Section(
              title: 'WhatsApp templates',
              child: Column(children: [
                for (final template in _templates)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text((template['label'] ?? template['eventType']).toString()),
                    subtitle: Text(template['metaName'].toString()),
                    trailing: DropdownButton<String>(
                      value: template['status'].toString(),
                      items: const ['pending', 'approved', 'rejected', 'paused'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                      onChanged: (value) async { await _service.setTemplateStatus(template['eventType'].toString(), template['metaName'].toString(), value!); await _load(); },
                    ),
                  ),
              ]),
            ),
            _Section(
              title: 'Outcome unknown (${_unknown.length})',
              child: Column(children: [
                if (_unknown.isEmpty) const Text('Nothing to reconcile.'),
                for (final row in _unknown)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${row['schoolName'] ?? row['tenantId']} · ${channelLabels[row['channel']] ?? row['channel']}'),
                    subtitle: Text((row['error'] ?? '').toString()),
                    trailing: Wrap(spacing: 4, children: [
                      TextButton(onPressed: () async { await _service.resolve(row['id'].toString(), true); await _load(); }, child: const Text('Sent')),
                      TextButton(onPressed: () async { await _service.resolve(row['id'].toString(), false); await _load(); }, child: const Text('Not sent')),
                    ]),
                  ),
              ]),
            ),
          ]),
        ),
      );
}
