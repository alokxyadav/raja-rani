import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/live_classes_repository.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final liveClassesRepositoryProvider =
    Provider((ref) => LiveClassesRepository(ref.watch(apiClientProvider)));

final upcomingLiveClassesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(liveClassesRepositoryProvider).listUpcoming();
});

class LiveClassesScreen extends ConsumerWidget {
  const LiveClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(upcomingLiveClassesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Live Classes')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(upcomingLiveClassesProvider),
        child: classesAsync.when(
          data: (classes) => classes.isEmpty
              ? const Center(child: Text('No live classes scheduled right now.', style: TextStyle(color: AppColors.textMuted)))
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: classes.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _LiveClassCard(liveClass: classes[i]),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load live classes.', style: TextStyle(color: AppColors.error)),
                TextButton(onPressed: () => ref.invalidate(upcomingLiveClassesProvider), child: const Text('Retry')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LiveClassCard extends ConsumerStatefulWidget {
  const _LiveClassCard({required this.liveClass});
  final Map<String, dynamic> liveClass;

  @override
  ConsumerState<_LiveClassCard> createState() => _LiveClassCardState();
}

class _LiveClassCardState extends ConsumerState<_LiveClassCard> {
  bool _busy = false;
  bool _reminderSet = false;

  Future<void> _handlePrimaryAction() async {
    final status = widget.liveClass['status'] as String;
    setState(() => _busy = true);
    try {
      if (status == 'SCHEDULED') {
        await ref.read(liveClassesRepositoryProvider).setReminder(widget.liveClass['id']);
        setState(() => _reminderSet = true);
      } else if (status == 'LIVE') {
        final joinUrl = await ref.read(liveClassesRepositoryProvider).join(widget.liveClass['id']);
        await launchUrl(Uri.parse(joinUrl), mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) {
        final message = e.toString().contains('403')
            ? "You're not enrolled in the related course."
            : 'Something went wrong. Please try again.';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.liveClass['status'] as String;
    final title = widget.liveClass['title'] as String;
    final instructor = widget.liveClass['instructorName'] as String;
    final scheduledAt = DateTime.tryParse(widget.liveClass['scheduledAt'] ?? '');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (status == 'LIVE') const _LiveDot(),
                      Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('with $instructor', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  if (scheduledAt != null)
                    Text(_formatDateTime(scheduledAt), style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
            ),
            _buildActionButton(status),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(String status) {
    if (_busy) {
      return const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2));
    }
    switch (status) {
      case 'LIVE':
        return ElevatedButton(onPressed: _handlePrimaryAction, child: const Text('Join Now'));
      case 'SCHEDULED':
        return _reminderSet
            ? const Chip(label: Text('Reminder set'), avatar: Icon(Icons.check, size: 16))
            : OutlinedButton(onPressed: _handlePrimaryAction, child: const Text('Remind me'));
      case 'ENDED':
        final hasRecording = widget.liveClass['recordingUrl'] != null;
        return hasRecording
            ? TextButton(
                onPressed: () => launchUrl(Uri.parse(widget.liveClass['recordingUrl'])),
                child: const Text('Watch recording'),
              )
            : const Text('Ended', style: TextStyle(color: AppColors.textMuted));
      case 'CANCELLED':
        return const Text('Cancelled', style: TextStyle(color: AppColors.error));
      default:
        return const SizedBox.shrink();
    }
  }

  String _formatDateTime(DateTime dt) {
    final local = dt.toLocal();
    return '${local.day}/${local.month}/${local.year} · ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}

class _LiveDot extends StatelessWidget {
  const _LiveDot();
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      width: 8,
      height: 8,
      decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
    );
  }
}
