import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser, CurrentUserPayload } from './current-user.decorator';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestOtpDto,
  VerifyOtpDto,
  EnableMfaDto,
  DisableMfaDto,
  VerifyMfaLoginDto,
  GoogleLoginDto,
} from './dto/auth.dto';
import { ApiTags } from '@nestjs/swagger';

// Every route below is @Public() — reachable without a bearer token, since
// they're how a token is obtained in the first place. The global JwtAuthGuard
// (see app.module.ts) still runs but skips them because of the decorator.
@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // ---------- MFA ----------

  // Authenticated (not @Public()) — a user sets up MFA for their own
  // already-logged-in account, never for someone else's.
  @Post('mfa/setup')
  setupMfa(@CurrentUser() user: CurrentUserPayload) {
    return this.auth.setupMfa(user.id);
  }

  @Post('mfa/enable')
  enableMfa(@Body() dto: EnableMfaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.auth.enableMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  disableMfa(@Body() dto: DisableMfaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.auth.disableMfa(user.id, dto.password);
  }

  // Public — this is step 2 of login, called before a session exists. The
  // short-lived mfaToken from login()'s challenge response is what
  // authenticates this request, not a bearer token.
  @Public()
  @Post('mfa/verify-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyMfaLogin(@Body() dto: VerifyMfaLoginDto) {
    return this.auth.verifyMfaLogin(dto.mfaToken, dto.code);
  }

  // The "who am I" endpoint — needed by any client that wants to show the
  // logged-in user's own name/email, or compare a resource's ownerId
  // against "is this mine" (e.g. the mobile community feed's delete-own-
  // post button). Deliberately not solved by decoding the JWT client-side
  // instead — the JWT only carries {sub, role}, and a real profile fetch
  // is one round-trip that stays correct if the token payload ever changes
  // shape, rather than every client re-implementing JWT parsing.
  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.auth.getProfile(user.id);
  }
}
