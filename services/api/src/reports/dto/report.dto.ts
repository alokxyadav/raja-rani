import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsEnum(['COMMUNITY_POST', 'COMMUNITY_COMMENT', 'REVIEW'])
  resourceType: 'COMMUNITY_POST' | 'COMMUNITY_COMMENT' | 'REVIEW';

  @IsString()
  resourceId: string;

  @IsString()
  @MinLength(3)
  reason: string;
}
