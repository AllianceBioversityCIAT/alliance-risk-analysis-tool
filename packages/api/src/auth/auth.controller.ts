import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';
import { CognitoService } from './cognito.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserClaims } from '../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompletePasswordChangeDto } from './dto/complete-password-change.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * POST /api/auth/login
   * Authenticates a user. Returns tokens or a password change challenge.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.cognitoService.login(dto.email, dto.password);
  }

  /**
   * POST /api/auth/refresh-token
   * Exchanges a refresh token for new access tokens.
   */
  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.cognitoService.refreshToken(dto.refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Client-side logout — clears local tokens. No server-side invalidation (Cognito stateless JWTs).
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /api/auth/forgot-password
   * Initiates the forgot password flow — sends a verification code to the user's email.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.cognitoService.forgotPassword(dto.email);
    return { message: 'If this email is registered, a reset code has been sent.' };
  }

  /**
   * POST /api/auth/reset-password
   * Completes the forgot password flow using the verification code.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.cognitoService.resetPassword(dto.username, dto.code, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }

  /**
   * POST /api/auth/complete-password-change
   * Completes the NEW_PASSWORD_REQUIRED Cognito challenge on first login.
   */
  @Public()
  @Post('complete-password-change')
  @HttpCode(HttpStatus.OK)
  async completePasswordChange(@Body() dto: CompletePasswordChangeDto) {
    return this.cognitoService.completePasswordChange(
      dto.username,
      dto.session,
      dto.newPassword,
    );
  }

  /**
   * POST /api/auth/change-password
   * Changes a user's own password while authenticated.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() req: { headers: { authorization?: string } },
  ) {
    const accessToken = req.headers.authorization?.substring(7) ?? '';
    await this.cognitoService.changePassword(
      accessToken,
      dto.previousPassword,
      dto.proposedPassword,
    );
    return { message: 'Password changed successfully.' };
  }

  /**
   * GET /api/auth/me
   * Returns the current user's profile from Cognito.
   */
  @Get('me')
  async getMe(
    @CurrentUser() user: UserClaims,
    @Request() req: { headers: { authorization?: string } },
  ) {
    const accessToken = req.headers.authorization?.substring(7) ?? '';
    return this.cognitoService.getCurrentUser(accessToken);
  }
}
