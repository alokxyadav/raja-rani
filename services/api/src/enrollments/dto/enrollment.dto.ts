import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsUUID()
  lessonId: string;

  @IsInt()
  @Min(0)
  positionSeconds: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
