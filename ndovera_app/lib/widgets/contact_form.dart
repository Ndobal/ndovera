import 'package:flutter/material.dart';

import '../theme/brand.dart';

/// Data captured by [ContactForm].
class ContactSubmission {
  ContactSubmission({required this.name, required this.email, required this.extra, required this.message});
  final String name;
  final String email;
  final String extra;
  final String message;
}

/// A simple, validating contact form.
///
/// When [onSubmit] is provided it is awaited (used to POST to the real
/// enquiry endpoint); otherwise a local confirmation snackbar is shown.
class ContactForm extends StatefulWidget {
  const ContactForm({super.key, this.cta = 'Send message', this.extraField, this.onSubmit});

  final String cta;

  /// Optional extra labelled field (e.g. "School name", "Company").
  final String? extraField;

  /// Async submit handler. Throw to surface an error to the user.
  final Future<void> Function(ContactSubmission)? onSubmit;

  @override
  State<ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends State<ContactForm> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _extra = TextEditingController();
  final _message = TextEditingController();
  bool _sent = false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _extra.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      if (widget.onSubmit != null) {
        await widget.onSubmit!(ContactSubmission(
          name: _name.text.trim(),
          email: _email.text.trim(),
          extra: _extra.text.trim(),
          message: _message.text.trim(),
        ));
      }
      if (!mounted) return;
      setState(() => _sent = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks — we’ll be in touch shortly.')),
      );
      _formKey.currentState!.reset();
      _name.clear();
      _email.clear();
      _extra.clear();
      _message.clear();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final twoCol = !Breaks.isMobile(context);
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (twoCol)
            Row(
              children: [
                Expanded(child: _field(_name, 'Your name', validator: _required)),
                const SizedBox(width: 16),
                Expanded(child: _field(_email, 'Email', validator: _emailValidator)),
              ],
            )
          else ...[
            _field(_name, 'Your name', validator: _required),
            const SizedBox(height: 16),
            _field(_email, 'Email', validator: _emailValidator),
          ],
          const SizedBox(height: 16),
          if (widget.extraField != null) ...[
            _field(_extra, widget.extraField!),
            const SizedBox(height: 16),
          ],
          _field(_message, 'Message', maxLines: 4, validator: _required),
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: _busy ? null : _submit,
              icon: _busy
                  ? const SizedBox(
                      height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(_sent ? Icons.check : Icons.send, size: 18),
              label: Text(_busy ? 'Sending…' : (_sent ? 'Sent' : widget.cta)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {int maxLines = 1, String? Function(String?)? validator}) {
    return TextFormField(
      controller: c,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(labelText: label),
    );
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
  String? _emailValidator(String? v) {
    if (v == null || v.trim().isEmpty) return 'Required';
    if (!v.contains('@')) return 'Enter a valid email';
    return null;
  }
}
