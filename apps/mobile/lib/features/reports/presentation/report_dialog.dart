import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/reports_repository.dart';
import '../../../core/theme/app_theme.dart';

/// One shared entry point for "report this" across the app — community
/// posts, comments, and reviews all call this instead of each screen
/// building its own dialog, so the reporting UX (and the reason options)
/// stays consistent everywhere it appears.
Future<void> showReportDialog(
  BuildContext context,
  WidgetRef ref, {
  required String resourceType,
  required String resourceId,
}) async {
  final reasons = ['Spam', 'Harassment or abuse', 'Inappropriate content', 'Other'];
  String? selectedReason;

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Report content'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: reasons
              .map(
                (reason) => RadioListTile<String>(
                  value: reason,
                  groupValue: selectedReason,
                  onChanged: (v) => setState(() => selectedReason = v),
                  title: Text(reason),
                  contentPadding: EdgeInsets.zero,
                ),
              )
              .toList(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: selectedReason == null ? null : () => Navigator.of(context).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    ),
  );

  if (confirmed != true || selectedReason == null) return;

  try {
    await ref.read(reportsRepositoryProvider).submitReport(
          resourceType: resourceType,
          resourceId: resourceId,
          reason: selectedReason!,
        );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thanks — our team will review this.')),
      );
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not submit the report. Please try again.'), backgroundColor: AppColors.error),
      );
    }
  }
}
