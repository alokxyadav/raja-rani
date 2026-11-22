import { IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;
}

export class BroadcastNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  deepLink?: string;

  @IsOptional()
  @IsIn(['ALL', 'STUDENT'])
  audience?: 'ALL' | 'STUDENT';
}
