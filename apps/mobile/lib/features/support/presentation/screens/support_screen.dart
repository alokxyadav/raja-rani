import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/support_repository.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final supportRepositoryProvider = Provider((ref) => SupportRepository(ref.watch(apiClientProvider)));

final myTicketsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(supportRepositoryProvider).getMyTickets();
});

const _categories = {
  'PAYMENT': 'Payment issue',
  'COURSE': 'Course issue',
  'VIDEO': 'Video issue',
  'OTHER': 'Something else',
};

const _statusColors = {
  'OPEN': AppColors.secondary,
  'IN_PROGRESS': AppColors.primary,
  'RESOLVED': AppColors.success,
  'CLOSED': AppColors.textMuted,
};

class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(myTicketsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myTicketsProvider),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            const Text('Frequently asked questions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: AppSpacing.sm),
            // Static for now — the brief's FAQ content is editorial copy,
            // not something to invent; wiring this to a real CMS-driven
            // list (an AppSetting-backed or dedicated Faq model) is a
            // separate, small addition once real FAQ content exists.
            const _FaqTile(
              question: 'How do I get a certificate?',
              answer: 'Complete every lesson in a course that has certificates enabled. It\'s issued automatically.',
            ),
            const _FaqTile(
              question: 'My payment succeeded but the course is locked',
              answer: 'This can take a minute to confirm. If it persists after a few minutes, submit a payment issue below.',
            ),
            const _FaqTile(
              question: 'How do I get a refund?',
              answer: 'Contact support below with your order details and we\'ll review it.',
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text('Contact support', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: AppSpacing.sm),
            ElevatedButton(
              onPressed: () => _showNewTicketSheet(context, ref),
              child: const Text('Report an issue'),
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text('Your tickets', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: AppSpacing.sm),
            ticketsAsync.when(
              data: (tickets) => tickets.isEmpty
                  ? const Text('No tickets yet.', style: TextStyle(color: AppColors.textMuted))
                  : Column(children: tickets.map((t) => _TicketCard(ticket: t)).toList()),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Text('Could not load your tickets.', style: TextStyle(color: AppColors.error)),
            ),
          ],
        ),
      ),
    );
  }

  void _showNewTicketSheet(BuildContext context, WidgetRef ref) {
    String category = 'OTHER';
    final subjectController = TextEditingController();
    final messageController = TextEditingController();
    bool submitting = false;
    String? error;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Report an issue', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                value: category,
                items: _categories.entries
                    .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setSheetState(() => category = v ?? 'OTHER'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: subjectController,
                decoration: const InputDecoration(labelText: 'Subject'),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: messageController,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Describe the issue'),
              ),
              if (error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(error!, style: const TextStyle(color: AppColors.error)),
              ],
              const SizedBox(height: AppSpacing.sm),
              ElevatedButton(
                onPressed: submitting
                    ? null
                    : () async {
                        setSheetState(() => submitting = true);
                        try {
                          await ref.read(supportRepositoryProvider).createTicket(
                                category: category,
                                subject: subjectController.text.trim(),
                                message: messageController.text.trim(),
                              );
                          ref.invalidate(myTicketsProvider);
                          if (context.mounted) Navigator.of(context).pop();
                        } catch (e) {
                          setSheetState(() {
                            submitting = false;
                            error = 'Could not submit — check the fields and try again.';
                          });
                        }
                      },
                child: Text(submitting ? 'Submitting…' : 'Submit'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  const _FaqTile({required this.question, required this.answer});
  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      title: Text(question, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: AppSpacing.sm),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Text(answer, style: const TextStyle(color: AppColors.textMuted)),
        ),
      ],
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});
  final Map<String, dynamic> ticket;

  @override
  Widget build(BuildContext context) {
    final status = ticket['status'] as String;
    final color = _statusColors[status] ?? AppColors.textMuted;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(ticket['subject'], style: const TextStyle(fontWeight: FontWeight.w600))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(AppRadii.chip)),
                  child: Text(status, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(ticket['message'], style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
            if (ticket['adminResponse'] != null) ...[
              const Divider(),
              const Text('Support response:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
              Text(ticket['adminResponse'], style: const TextStyle(fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}
