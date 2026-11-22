import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/orders_repository.dart';
import '../../../../core/network/providers.dart';
import '../../../../core/theme/app_theme.dart';

final ordersRepositoryProvider = Provider((ref) => OrdersRepository(ref.watch(apiClientProvider)));

final myOrdersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(ordersRepositoryProvider).getMyOrders();
});

const _statusColors = {
  'PAID': AppColors.success,
  'PENDING': AppColors.secondary,
  'FAILED': AppColors.error,
  'REFUNDED': AppColors.textMuted,
};

class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Order History')),
      body: ordersAsync.when(
        data: (orders) => orders.isEmpty
            ? const Center(
                child: Text('No orders yet.', style: TextStyle(color: AppColors.textMuted)),
              )
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, i) => _OrderCard(order: orders[i]),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load your orders.', style: TextStyle(color: AppColors.error)),
              TextButton(onPressed: () => ref.invalidate(myOrdersProvider), child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final items = (order['items'] as List).cast<Map<String, dynamic>>();
    final courseTitles = items.map((i) => i['course']['title']).join(', ');
    final status = order['status'] as String;
    final color = _statusColors[status] ?? AppColors.textMuted;
    final createdAt = DateTime.tryParse(order['createdAt'] ?? '');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(courseTitles, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  if (createdAt != null)
                    Text(
                      '${createdAt.day}/${createdAt.month}/${createdAt.year}',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('₹${order['totalAmount']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppRadii.chip),
                  ),
                  child: Text(status, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
