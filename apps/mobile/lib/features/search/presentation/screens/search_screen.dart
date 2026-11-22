import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../courses/data/courses_providers.dart';
import '../../../courses/data/course_models.dart';
import '../../../courses/presentation/widgets/course_card.dart';
import '../../../../core/theme/app_theme.dart';

const _sortLabels = {
  'newest': 'Newest',
  'price_low_to_high': 'Price: Low to High',
  'price_high_to_low': 'Price: High to Low',
  'highest_rated': 'Highest Rated',
};

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<CourseSummary>? _results;
  bool _loading = false;
  String? _error;

  // Filter/sort state — search runs on ANY of these changing, not just
  // text input, so "show me free courses sorted by rating" works with an
  // empty search box too, per the brief's category/price/rating filtering
  // being independent features from text search.
  String? _accessType;
  String _sort = 'newest';
  int? _minRating;

  bool get _hasActiveQuery =>
      _controller.text.trim().isNotEmpty || _accessType != null || _minRating != null || _sort != 'newest';

  // Debounced per the brief's explicit "search should ... add debouncing"
  // requirement — waits for a pause in typing before hitting the API.
  void _onTextChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _runSearch);
  }

  Future<void> _runSearch() async {
    if (!_hasActiveQuery) {
      setState(() => _results = null);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ref.read(coursesRepositoryProvider).listCourses(
            search: _controller.text.trim().isEmpty ? null : _controller.text.trim(),
            accessType: _accessType,
            minRating: _minRating,
            sort: _sort,
          );
      if (mounted) setState(() => _results = results);
    } catch (e) {
      if (mounted) setState(() => _error = 'Search failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          onChanged: _onTextChanged,
          decoration: const InputDecoration(
            hintText: 'Search courses…',
            border: InputBorder.none,
          ),
        ),
      ),
      body: Column(
        children: [
          _FilterBar(
            accessType: _accessType,
            sort: _sort,
            minRating: _minRating,
            onAccessTypeChanged: (v) {
              setState(() => _accessType = v);
              _runSearch();
            },
            onSortChanged: (v) {
              setState(() => _sort = v);
              _runSearch();
            },
            onMinRatingChanged: (v) {
              setState(() => _minRating = v);
              _runSearch();
            },
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(color: AppColors.error)));
    if (_results == null) {
      return const Center(child: Text('Search for a course, or use filters below.', style: TextStyle(color: AppColors.textMuted)));
    }
    if (_results!.isEmpty) {
      return const Center(child: Text('No courses matched.', style: TextStyle(color: AppColors.textMuted)));
    }
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.md),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
        childAspectRatio: 0.72,
      ),
      itemCount: _results!.length,
      itemBuilder: (context, i) => CourseCard(
        course: _results![i],
        onTap: () => context.push('/course/${_results![i].slug}'),
        width: null,
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.accessType,
    required this.sort,
    required this.minRating,
    required this.onAccessTypeChanged,
    required this.onSortChanged,
    required this.onMinRatingChanged,
  });

  final String? accessType;
  final String sort;
  final int? minRating;
  final ValueChanged<String?> onAccessTypeChanged;
  final ValueChanged<String> onSortChanged;
  final ValueChanged<int?> onMinRatingChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Row(
        children: [
          ChoiceChip(
            label: const Text('Free'),
            selected: accessType == 'FREE',
            onSelected: (selected) => onAccessTypeChanged(selected ? 'FREE' : null),
          ),
          const SizedBox(width: AppSpacing.sm),
          ChoiceChip(
            label: const Text('Paid'),
            selected: accessType == 'PAID',
            onSelected: (selected) => onAccessTypeChanged(selected ? 'PAID' : null),
          ),
          const SizedBox(width: AppSpacing.sm),
          ChoiceChip(
            label: const Text('4★ & up'),
            selected: minRating == 4,
            onSelected: (selected) => onMinRatingChanged(selected ? 4 : null),
          ),
          const SizedBox(width: AppSpacing.sm),
          PopupMenuButton<String>(
            initialValue: sort,
            onSelected: onSortChanged,
            itemBuilder: (context) => _sortLabels.entries
                .map((e) => PopupMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            child: Chip(
              label: Text('Sort: ${_sortLabels[sort]}'),
              avatar: const Icon(Icons.sort, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}
