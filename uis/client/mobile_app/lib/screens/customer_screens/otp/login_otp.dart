import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../widgets/error_snackbar.dart';

class LoginOtpScreen extends StatefulWidget {
	const LoginOtpScreen({super.key});

	@override
	State<LoginOtpScreen> createState() => _LoginOtpScreenState();
}

class _LoginOtpScreenState extends State<LoginOtpScreen> {
	final _controller = TextEditingController();
	bool _submitting = false;

	Future<void> _verify() async {
		if (_controller.text.length != 6) {
			ErrorSnackbar.show(
				context,
				'Enter 6-digit OTP',
			);
			return;
		}
		
		setState(() => _submitting = true);

		// Get email from navigation arguments
		final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
		final email = args?['email'] as String? ?? '';

		final authProvider = context.read<AuthProvider>();
		final success = await authProvider.verifyLoginOTP(email, _controller.text.trim());

		if (!mounted) return;
		
		setState(() => _submitting = false);

		if (success) {
			// Navigate to dashboard
			Navigator.pushNamedAndRemoveUntil(
				context,
				'/dashboard',
				(route) => false,
			);
		} else {
			// Show error message
			ErrorSnackbar.show(
				context,
				authProvider.errorMessage ?? 'Login OTP verification failed',
			);
		}
	}

	@override
	Widget build(BuildContext context) {
		return Scaffold(
			appBar: AppBar(title: const Text('Login OTP')),
			body: Padding(
				padding: const EdgeInsets.all(24),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.stretch,
					children: [
						const SizedBox(height: 12),
						const Text('Enter the OTP sent to your phone/email'),
						const SizedBox(height: 16),
						TextField(
							controller: _controller,
							keyboardType: TextInputType.number,
							maxLength: 6,
							decoration: InputDecoration(
								labelText: 'OTP',
								border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
							),
						),
						const SizedBox(height: 12),
						SizedBox(
							height: 48,
							child: ElevatedButton(
								onPressed: _submitting ? null : _verify,
								child: _submitting
										? const SizedBox(
												height: 20,
												width: 20,
												child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
											)
										: const Text('Verify & Continue'),
							),
						),
						TextButton(
							onPressed: () async {
								// await _authService.resendLoginOtp(phone);
								if (context.mounted) {
									ScaffoldMessenger.of(context).showSnackBar(
										const SnackBar(content: Text('Resend OTP functionality coming soon')),
									);
								}
							},
							child: const Text('Resend OTP'),
						),
					],
				),
			),
		);
	}
}
