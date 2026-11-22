import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be a valid E.164 number' })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;

  @IsString()
  password: string;
}

export class RequestOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone: string;

  @IsString()
  purpose: 'LOGIN' | 'REGISTER';
}

export class VerifyOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone: string;

  @IsString()
  @MinLength(4)
  code: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class SetupMfaDto {}

export class EnableMfaDto {
  @IsString()
  code: string;
}

export class DisableMfaDto {
  @IsString()
  password: string;
}

export class VerifyMfaLoginDto {
  @IsString()
  mfaToken: string;

  @IsString()
  code: string;
}

export class GoogleLoginDto {
  @IsString()
  idToken: string;
}
