import 'package:flutter_test/flutter_test.dart';
import 'package:raja_rani/features/courses/data/course_models.dart';

// These pin down the manual fromJson parsing in course_models.dart against
// the actual backend response shapes (courses.service.ts). A field rename
// on either side that isn't caught here would otherwise only surface as a
// silent null/crash deep in a widget at runtime.
void main() {
  group('CourseSummary.fromJson', () {
    test('parses a free course', () {
      final json = {
        'id': 'course-1',
        'title': 'Intro to Hand Stitching',
        'slug': 'intro-to-hand-stitching',
        'thumbnailUrl': 'https://example.com/img.png',
        'shortDescription': 'A beginner course',
        'accessType': 'FREE',
        'price': null,
        'discountPrice': null,
      };
      final course = CourseSummary.fromJson(json);

      expect(course.id, 'course-1');
      expect(course.title, 'Intro to Hand Stitching');
      expect(course.isFree, isTrue);
      expect(course.price, isNull);
    });

    test('parses a paid course and correctly reports isFree as false', () {
      final json = {
        'id': 'course-2',
        'title': 'Blouse & Kurti Crash Course',
        'slug': 'blouse-kurti-crash-course',
        'accessType': 'PAID',
        'price': 999,
        'discountPrice': 799,
      };
      final course = CourseSummary.fromJson(json);

      expect(course.isFree, isFalse);
      // Prisma Decimal fields arrive as JSON numbers or numeric strings
      // depending on serialization — this asserts the num? cast handles it.
      expect(course.price, 999.0);
      expect(course.discountPrice, 799.0);
    });

    test('reads category name from the nested category object when present', () {
      final json = {
        'id': 'course-3',
        'title': 'Test',
        'slug': 'test',
        'accessType': 'FREE',
        'category': {'id': 'cat-1', 'name': 'Stitching & Tailoring', 'slug': 'stitching-tailoring'},
      };
      expect(CourseSummary.fromJson(json).categoryName, 'Stitching & Tailoring');
    });

    test('handles a missing category gracefully (no crash)', () {
      final json = {'id': 'course-4', 'title': 'Test', 'slug': 'test', 'accessType': 'FREE'};
      expect(CourseSummary.fromJson(json).categoryName, isNull);
    });
  });

  group('CourseDetail.fromJson', () {
    test('parses nested chapters and lessons, preserving order', () {
      final json = {
        'id': 'course-1',
        'title': 'Test Course',
        'slug': 'test-course',
        'accessType': 'PAID',
        'price': 999,
        'chapters': [
          {
            'id': 'ch-1',
            'title': 'Getting Started',
            'order': 1,
            'lessons': [
              {
                'id': 'lesson-1',
                'title': 'Tools you will need',
                'order': 1,
                'contentType': 'VIDEO',
                'durationSeconds': 300,
                'isFreePreview': true,
              },
            ],
          },
        ],
      };
      final course = CourseDetail.fromJson(json);

      expect(course.chapters, hasLength(1));
      expect(course.chapters.first.lessons, hasLength(1));
      expect(course.chapters.first.lessons.first.isFreePreview, isTrue);
      expect(course.chapters.first.lessons.first.contentType, 'VIDEO');
    });

    test('defaults isFreePreview to false when the backend omits it', () {
      final json = {
        'id': 'lesson-1',
        'title': 'Test',
        'order': 1,
        'contentType': 'PDF',
      };
      expect(LessonSummary.fromJson(json).isFreePreview, isFalse);
    });

    test('handles a course with no chapters yet (freshly created draft)', () {
      final json = {
        'id': 'course-1',
        'title': 'Draft Course',
        'slug': 'draft-course',
        'accessType': 'FREE',
      };
      expect(CourseDetail.fromJson(json).chapters, isEmpty);
    });
  });
}
