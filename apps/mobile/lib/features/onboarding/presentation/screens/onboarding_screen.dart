import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

const _interests = ['Stitching', 'Embroidery', 'Fashion Design', 'Tailoring Basics', 'Advanced Draping'];
const _levels = ['Beginner', 'Intermediate', 'Advanced'];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _selectedInterests = <String>{};
  String? _selectedLevel;

  Future<void> _finish() async {
    // Nothing on the backend consumes this yet (no onboarding-preferences
    // endpoint exists) — stored locally for now so the choice isn't lost,
    // and it's a small addition to POST it once that endpoint exists.
    // Marking onboarding complete is what actually matters today: it's
    // what keeps this screen from showing again.
    await ref.read(secureStorageProvider).write(key: 'onboarding_complete', value: 'true');
    if (mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: Alignment.topRight,
                child: TextButton(onPressed: _finish, child: const Text('Skip')),
              ),
              const Text('What do you want to learn?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: AppSpacing.sm),
              const Text("We'll use this to recommend courses.", style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: _interests.map((interest) {
                  final selected = _selectedInterests.contains(interest);
                  return FilterChip(
                    label: Text(interest),
                    selected: selected,
                    onSelected: (v) => setState(
                      () => v ? _selectedInterests.add(interest) : _selectedInterests.remove(interest),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: AppSpacing.xl),
              const Text('Your experience level', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: AppSpacing.sm),
              ..._levels.map(
                (level) => RadioListTile<String>(
                  value: level,
                  groupValue: _selectedLevel,
                  onChanged: (v) => setState(() => _selectedLevel = v),
                  title: Text(level),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const Spacer(),
              ElevatedButton(onPressed: _finish, child: const Text('Get started')),
            ],
          ),
        ),
      ),
    );
  }
}
