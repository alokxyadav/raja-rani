import { IsEnum, IsIn, IsString, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsEnum(['PAYMENT', 'COURSE', 'VIDEO', 'OTHER'])
  category: 'PAYMENT' | 'COURSE' | 'VIDEO' | 'OTHER';

  @IsString()
  @MinLength(3)
  subject: string;

  @IsString()
  @MinLength(10)
  message: string;
}

export class RespondToTicketDto {
  @IsString()
  @MinLength(1)
  response: string;

  @IsIn(['IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}
