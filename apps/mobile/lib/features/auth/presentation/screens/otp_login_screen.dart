import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth_controller.dart';
import '../../../../core/theme/app_theme.dart';

class OtpLoginScreen extends ConsumerStatefulWidget {
  const OtpLoginScreen({super.key});

  @override
  ConsumerState<OtpLoginScreen> createState() => _OtpLoginScreenState();
}

class _OtpLoginScreenState extends ConsumerState<OtpLoginScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _otpSent = false;
  bool _isSubmitting = false;
  String? _errorText;

  Future<void> _requestOtp() async {
    if (_phoneController.text.trim().length < 8) {
      setState(() => _errorText = 'Enter a valid phone number');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorText = null;
    });
    try {
      await ref.read(authRepositoryProvider).requestOtp(_phoneController.text.trim());
      setState(() => _otpSent = true);
    } catch (_) {
      setState(() => _errorText = 'Could not send OTP. Please try again.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _isSubmitting = true;
      _errorText = null;
    });
    try {
      await ref.read(authStateProvider.notifier).verifyOtp(
            phone: _phoneController.text.trim(),
            code: _codeController.text.trim(),
          );
    } catch (_) {
      setState(() => _errorText = 'Incorrect or expired code.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log in with OTP')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _phoneController,
                enabled: !_otpSent,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile number', hintText: '+91XXXXXXXXXX'),
              ),
              if (_otpSent) ...[
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '6-digit code'),
                ),
              ],
              if (_errorText != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_errorText!, style: const TextStyle(color: AppColors.error)),
              ],
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: _isSubmitting ? null : (_otpSent ? _verifyOtp : _requestOtp),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(_otpSent ? 'Verify & continue' : 'Send OTP'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }
}
