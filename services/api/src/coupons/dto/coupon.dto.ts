import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @MinLength(3)
  code: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  percentOff?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
