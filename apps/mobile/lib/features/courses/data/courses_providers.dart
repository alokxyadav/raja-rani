import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/providers.dart';
import 'course_models.dart';
import 'courses_repository.dart';

final coursesRepositoryProvider = Provider<CoursesRepository>((ref) {
  return CoursesRepository(ref.watch(apiClientProvider));
});

final courseListProvider = FutureProvider.autoDispose<List<CourseSummary>>((ref) {
  return ref.watch(coursesRepositoryProvider).listCourses();
});

final courseDetailProvider =
    FutureProvider.autoDispose.family<CourseDetail, String>((ref, slug) {
  return ref.watch(coursesRepositoryProvider).getCourse(slug);
});

final libraryProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(coursesRepositoryProvider).getLibrary();
});

final activeBannersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(coursesRepositoryProvider).getActiveBanners();
});
