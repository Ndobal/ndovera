import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/auth_service.dart';
import '../theme/brand.dart';
import '../widgets/common.dart';

/// A real, working tenant/staff login screen wired to the Ndovera backend.
/// Every page in the app has a Login button that routes here.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _idCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _idCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final user = await AuthService.instance.login(
        id: _idCtrl.text,
        password: _pwCtrl.text,
      );
      if (!mounted) return;
      context.go('/welcome', extra: user);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgotPassword() async {
    final controller = TextEditingController(text: _idCtrl.text);
    final email = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset password'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Email', hintText: 'you@school.com'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Send link')),
        ],
      ),
    );
    if (email == null || email.trim().isEmpty) return;
    try {
      final msg = await AuthService.instance.requestPasswordReset(email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 920;
    return Scaffold(
      body: Row(
        children: [
          if (wide) const Expanded(child: _LoginAside()),
          Expanded(
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: _buildForm(context),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final theme = Theme.of(context);
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => context.go('/'),
              icon: const Icon(Icons.arrow_back, size: 18),
              label: const Text('Back to site'),
            ),
          ),
          const SizedBox(height: 8),
          const BrandWordmark(),
          const SizedBox(height: 28),
          Text('Welcome back', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Sign in with your account email and password to reach your dashboard.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.75),
            ),
          ),
          const SizedBox(height: 28),
          TextFormField(
            controller: _idCtrl,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.username, AutofillHints.email],
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'you@school.com',
              prefixIcon: Icon(Icons.alternate_email),
            ),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter your email' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _pwCtrl,
            obscureText: _obscure,
            autofillHints: const [AutofillHints.password],
            onFieldSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter your password' : null,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: _forgotPassword, child: const Text('Forgot password?')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Sign In'),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () => context.go('/tenant/admission'),
            child: const Text('Apply for admission instead'),
          ),
        ],
      ),
    );
  }
}

/// The decorative left panel shown on wide screens.
class _LoginAside extends StatelessWidget {
  const _LoginAside();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: Brand.heroLight,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const BrandWordmark(color: Colors.white, fontSize: 26),
            const SizedBox(height: 32),
            Text(
              'One calm system for your whole school.',
              style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    color: Colors.white,
                    height: 1.15,
                  ),
            ),
            const SizedBox(height: 20),
            Text(
              'Owners, teachers, parents and students — everyone signs in here to '
              'reach the dashboard built for their role.',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 16, height: 1.6),
            ),
            const SizedBox(height: 40),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: const [
                _Pill(Icons.shield_outlined, 'Secure sign-in'),
                _Pill(Icons.devices_outlined, 'Any device'),
                _Pill(Icons.bolt_outlined, 'Fast access'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Lightweight post-login placeholder. The real role dashboards are not yet
/// part of the Flutter app, so this confirms a successful sign-in and shows
/// which dashboard the user would be routed to.
class WelcomePage extends StatelessWidget {
  const WelcomePage({super.key, this.user});
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final u = user ?? AuthService.instance.currentUser;
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle, color: Brand.forest, size: 64),
                const SizedBox(height: 16),
                Text('Signed in', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                Text(
                  u == null
                      ? 'You are signed in.'
                      : 'Welcome${u.name.isNotEmpty ? ', ${u.name}' : ''}. '
                          'Your role is "${u.role}".',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 12),
                Text(
                  'Role dashboards are being rebuilt in Flutter next — this screen '
                  'confirms the login flow works end-to-end against the live API.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).textTheme.bodyMedium?.color?.withValues(alpha: 0.7),
                      ),
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    OutlinedButton(
                      onPressed: () {
                        AuthService.instance.signOut();
                        context.go('/login');
                      },
                      child: const Text('Sign out'),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(onPressed: () => context.go('/'), child: const Text('Back to site')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
