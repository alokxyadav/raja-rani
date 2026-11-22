import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateAnnouncementDto extends CreatePostDto {}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;
}
