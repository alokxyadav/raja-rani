import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CourseAccessTypeDto {
  FREE = 'FREE',
  PAID = 'PAID',
}

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsEnum(CourseAccessTypeDto)
  accessType: CourseAccessTypeDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsBoolean()
  certificateEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  certificateMinCompletionPct?: number;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsEnum(CourseAccessTypeDto)
  accessType?: CourseAccessTypeDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class CreateChapterDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsInt()
  @Min(0)
  order: number;
}

export class CreateLessonDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsEnum(['VIDEO', 'PDF', 'RESOURCE_LINK'])
  contentType: 'VIDEO' | 'PDF' | 'RESOURCE_LINK';

  @IsOptional()
  @IsString()
  videoAssetId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  resourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}

export enum CourseSortOption {
  NEWEST = 'newest',
  PRICE_LOW_TO_HIGH = 'price_low_to_high',
  PRICE_HIGH_TO_LOW = 'price_high_to_low',
  HIGHEST_RATED = 'highest_rated',
}

export class ListCoursesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(CourseAccessTypeDto)
  accessType?: CourseAccessTypeDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsEnum(CourseSortOption)
  sort?: CourseSortOption;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
