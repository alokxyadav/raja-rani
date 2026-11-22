import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateBannerDto extends CreateBannerDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
