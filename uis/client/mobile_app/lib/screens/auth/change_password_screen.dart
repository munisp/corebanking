import 'package:flutter/material.dart';
import 'package:mobile_app/config/app_theme.dart';
import 'package:mobile_app/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/widgets/error_snackbar.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _submitting = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Change Password'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppTheme.primaryColor, AppTheme.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(), // Prevent continuous scrolling on mobile
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),
                Text(
                  'Secure your account by updating your password.',
                  style: TextStyle(fontSize: 15, color: AppTheme.getTextSecondary(context)),
                ),
                const SizedBox(height: 24),
                _buildPasswordField(
                  controller: _currentController,
                  label: 'Current Password',
                  obscure: _obscureCurrent,
                  toggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                  validator: (v) {
                    if ((v ?? '').isEmpty) return 'Enter your current password';
                    if ((v ?? '').length < 6) return 'Must be at least 6 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                _buildPasswordField(
                  controller: _newController,
                  label: 'New Password',
                  obscure: _obscureNew,
                  toggle: () => setState(() => _obscureNew = !_obscureNew),
                  validator: (v) {
                    if ((v ?? '').isEmpty) return 'Enter a new password';
                    if ((v ?? '').length < 8) return 'Must be at least 8 characters';
                    if (!(v ?? '').contains(RegExp(r'[A-Z]'))) {
                      return 'Add at least one uppercase letter';
                    }
                    if (!(v ?? '').contains(RegExp(r'[0-9]'))) {
                      return 'Add at least one number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                _buildPasswordField(
                  controller: _confirmController,
                  label: 'Confirm New Password',
                  obscure: _obscureConfirm,
                  toggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                  validator: (v) {
                    if ((v ?? '').isEmpty) return 'Confirm your new password';
                    if (v != _newController.text) return 'Passwords do not match';
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _handleChangePassword,
                    child: _submitting
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Update Password'),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          Navigator.pushNamed(context, '/forgot-password');
                        },
                  child: const Text('Forgot current password?'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String label,
    required bool obscure,
    required VoidCallback toggle,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: IconButton(
          icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
          onPressed: toggle,
        ),
      ),
      validator: validator,
    );
  }

  Future<void> _handleChangePassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final success = await Provider.of<AuthProvider>(context, listen: false).changePassword(
          currentPassword: _currentController.text,
          newPassword: _newController.text,
          confirmPassword: _confirmController.text,
        );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      ErrorSnackbar.showSuccess(
        context,
        'Password updated successfully',
      );
      Navigator.pop(context);
    } else {
      ErrorSnackbar.show(
        context,
        Provider.of<AuthProvider>(context, listen: false).errorMessage ?? 'Unable to update password',
      );
    }
  }
}
