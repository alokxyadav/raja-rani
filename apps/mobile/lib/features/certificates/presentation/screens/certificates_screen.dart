import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/certificates_repository.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final certificatesRepositoryProvider =
    Provider((ref) => CertificatesRepository(ref.watch(apiClientProvider)));

final myCertificatesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(certificatesRepositoryProvider).getMine();
});

class CertificatesScreen extends ConsumerWidget {
  const CertificatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final certsAsync = ref.watch(myCertificatesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Certificates')),
      body: certsAsync.when(
        data: (certs) => certs.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.xl),
                  child: Text(
                    'Complete a course to earn your first certificate.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: certs.length,
                separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, i) => _CertificateCard(cert: certs[i]),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load certificates.', style: TextStyle(color: AppColors.error)),
              TextButton(onPressed: () => ref.invalidate(myCertificatesProvider), child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}

class _CertificateCard extends StatelessWidget {
  const _CertificateCard({required this.cert});
  final Map<String, dynamic> cert;

  @override
  Widget build(BuildContext context) {
    final course = cert['course'] as Map<String, dynamic>?;
    final certNo = cert['certificateNo'] as String;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            const Icon(Icons.workspace_premium, color: AppColors.secondary, size: 36),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(course?['title'] ?? 'Course', style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(certNo, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.share_outlined),
              onPressed: () {
                // Shares the public verification link
                // (GET /api/v1/certificates/verify/:certificateNo on the
                // backend) — wiring an actual share sheet needs the
                // share_plus package, a one-line addition when you're ready.
              },
            ),
          ],
        ),
      ),
    );
  }
}
