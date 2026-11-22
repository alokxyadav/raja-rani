import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.build_circle_outlined, size: 64, color: AppColors.primary),
              const SizedBox(height: AppSpacing.md),
              const Text("We'll be right back", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                "Raja Rani is undergoing scheduled maintenance. Please check back shortly.",
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
