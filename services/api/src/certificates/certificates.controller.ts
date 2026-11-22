import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { CertificatesService } from './certificates.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('certificates')
@ApiBearerAuth('access-token')
@Controller('api/v1/certificates')
export class CertificatesController {
  constructor(private certificates: CertificatesService) {}

  @Get('mine')
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.certificates.listForUser(user.id);
  }

  // Matches the brief's /verify/{certificateId} requirement — public,
  // no auth, so anyone with a QR code or the printed number can check it.
  @Public()
  @Get('verify/:certificateNo')
  verify(@Param('certificateNo') certificateNo: string) {
    return this.certificates.verifyPublic(certificateNo);
  }
}
