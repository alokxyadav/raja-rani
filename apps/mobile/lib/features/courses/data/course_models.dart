/// Deliberately a plain class with a manual fromJson, not freezed/json_serializable
/// — those need `dart run build_runner build` before the app compiles, which
/// this environment can't run (see docs/SETUP_GUIDE.md in this app for why).
/// Swap to freezed once you're running builds locally; the shape stays the same.
class CourseSummary {
  CourseSummary({
    required this.id,
    required this.title,
    required this.slug,
    this.thumbnailUrl,
    this.shortDescription,
    required this.accessType,
    this.price,
    this.discountPrice,
    this.categoryName,
    this.averageRating,
    this.reviewCount = 0,
  });

  final String id;
  final String title;
  final String slug;
  final String? thumbnailUrl;
  final String? shortDescription;
  final String accessType; // "FREE" | "PAID"
  final double? price;
  final double? discountPrice;
  final String? categoryName;
  final double? averageRating;
  final int reviewCount;

  bool get isFree => accessType == 'FREE';

  factory CourseSummary.fromJson(Map<String, dynamic> json) => CourseSummary(
        id: json['id'],
        title: json['title'],
        slug: json['slug'],
        thumbnailUrl: json['thumbnailUrl'],
        shortDescription: json['shortDescription'],
        accessType: json['accessType'],
        price: (json['price'] as num?)?.toDouble(),
        discountPrice: (json['discountPrice'] as num?)?.toDouble(),
        categoryName: json['category']?['name'],
        averageRating: (json['averageRating'] as num?)?.toDouble(),
        reviewCount: json['reviewCount'] ?? 0,
      );
}

class LessonSummary {
  LessonSummary({
    required this.id,
    required this.title,
    required this.order,
    required this.contentType,
    this.durationSeconds,
    required this.isFreePreview,
  });

  final String id;
  final String title;
  final int order;
  final String contentType;
  final int? durationSeconds;
  final bool isFreePreview;

  factory LessonSummary.fromJson(Map<String, dynamic> json) => LessonSummary(
        id: json['id'],
        title: json['title'],
        order: json['order'],
        contentType: json['contentType'],
        durationSeconds: json['durationSeconds'],
        isFreePreview: json['isFreePreview'] ?? false,
      );
}

class ChapterSummary {
  ChapterSummary({required this.id, required this.title, required this.order, required this.lessons});

  final String id;
  final String title;
  final int order;
  final List<LessonSummary> lessons;

  factory ChapterSummary.fromJson(Map<String, dynamic> json) => ChapterSummary(
        id: json['id'],
        title: json['title'],
        order: json['order'],
        lessons: (json['lessons'] as List)
            .map((l) => LessonSummary.fromJson(l as Map<String, dynamic>))
            .toList(),
      );
}

class CourseDetail extends CourseSummary {
  CourseDetail({
    required super.id,
    required super.title,
    required super.slug,
    super.thumbnailUrl,
    super.shortDescription,
    required super.accessType,
    super.price,
    super.discountPrice,
    super.categoryName,
    super.averageRating,
    super.reviewCount,
    this.description,
    this.learningOutcomes = const [],
    this.instructorName,
    required this.chapters,
  });

  final String? description;
  final List<String> learningOutcomes;
  final String? instructorName;
  final List<ChapterSummary> chapters;

  factory CourseDetail.fromJson(Map<String, dynamic> json) => CourseDetail(
        id: json['id'],
        title: json['title'],
        slug: json['slug'],
        thumbnailUrl: json['thumbnailUrl'],
        shortDescription: json['shortDescription'],
        accessType: json['accessType'],
        price: (json['price'] as num?)?.toDouble(),
        discountPrice: (json['discountPrice'] as num?)?.toDouble(),
        categoryName: json['category']?['name'],
        averageRating: (json['averageRating'] as num?)?.toDouble(),
        reviewCount: json['reviewCount'] ?? 0,
        description: json['description'],
        learningOutcomes: (json['learningOutcomes'] as List?)?.cast<String>() ?? [],
        instructorName: json['instructor']?['name'],
        chapters: (json['chapters'] as List? ?? [])
            .map((c) => ChapterSummary.fromJson(c as Map<String, dynamic>))
            .toList(),
      );
}
