import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateLiveClassDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(2)
  instructorName: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(5)
  durationMinutes: number;
}

export class EndLiveClassDto {
  @IsOptional()
  @IsString()
  recordingUrl?: string;
}
