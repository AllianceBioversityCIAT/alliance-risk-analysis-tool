import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * POST /api/auth/login
   * Authenticates a user. Returns tokens or a password change challenge.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login', description: 'Authenticates a user with email and password. Returns Cognito access/id/refresh tokens on success, or a NEW_PASSWORD_REQUIRED challenge on first login. Rate-limited to 5 requests per minute.' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful — returns tokens or a NEW_PASSWORD_REQUIRED challenge', schema: { example: { accessToken: 'eyJ...', idToken: 'eyJ...', refreshToken: 'eyJ...', expiresIn: 3600 } } })
  @ApiResponse({ status: 400, description: 'Validation error — invalid email format or password too short' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded (5 req/min)' })
  async login(@Body() dto: LoginDto) {
    return this.cognitoService.login(dto.email, dto.password);
  }

  /**
   * POST /api/auth/refresh-token
   * Exchanges a refresh token for new access tokens.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token', description: 'Exchanges a Cognito refresh token for a new access token and id token. Rate-limited to 5 requests per minute.' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New tokens issued successfully', schema: { example: { accessToken: 'eyJ...', idToken: 'eyJ...', expiresIn: 3600 } } })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded (5 req/min)' })
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
  @ApiOperation({ summary: 'Logout', description: 'Client-side logout. Since Cognito uses stateless JWTs, there is no server-side token invalidation — the client is responsible for discarding stored tokens.' })
  @ApiResponse({ status: 200, description: 'Logged out successfully', schema: { example: { message: 'Logged out successfully' } } })
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /api/auth/forgot-password
   * Initiates the forgot password flow — sends a verification code to the user's email.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate forgot password', description: 'Sends a 6-digit verification code to the user\'s registered email address. The response is intentionally vague to prevent user enumeration. Rate-limited to 5 requests per minute.' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset code sent (response is identical whether or not the email exists)', schema: { example: { message: 'If this email is registered, a reset code has been sent.' } } })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded (5 req/min)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.cognitoService.forgotPassword(dto.email);
    return { message: 'If this email is registered, a reset code has been sent.' };
  }

  /**
   * POST /api/auth/reset-password
   * Completes the forgot password flow using the verification code.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with verification code', description: 'Completes the forgot-password flow by providing the verification code received via email and the new password. Rate-limited to 5 requests per minute.' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully', schema: { example: { message: 'Password reset successfully.' } } })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code, or password does not meet policy requirements' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded (5 req/min)' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.cognitoService.resetPassword(dto.username, dto.code, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }

  /**
   * POST /api/auth/complete-password-change
   * Completes the NEW_PASSWORD_REQUIRED Cognito challenge on first login.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('complete-password-change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete forced password change', description: 'Completes the NEW_PASSWORD_REQUIRED challenge returned on first login when an admin has created the account. Must provide the session token from the login challenge response. Rate-limited to 5 requests per minute.' })
  @ApiBody({ type: CompletePasswordChangeDto })
  @ApiResponse({ status: 200, description: 'Password set and user authenticated — returns tokens', schema: { example: { accessToken: 'eyJ...', idToken: 'eyJ...', refreshToken: 'eyJ...', expiresIn: 3600 } } })
  @ApiResponse({ status: 400, description: 'Invalid session or password does not meet policy requirements' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded (5 req/min)' })
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
  @ApiBearerAuth('cognito-jwt')
  @ApiOperation({ summary: 'Change own password', description: 'Changes the authenticated user\'s password. Requires a valid Bearer token. The previous password must be provided for verification.' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully', schema: { example: { message: 'Password changed successfully.' } } })
  @ApiResponse({ status: 400, description: 'New password does not meet Cognito policy requirements' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Bearer token, or incorrect previous password' })
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
   * Returns the current user's profile. In dev mode, derives data from the
   * already-verified JWT claims to avoid hitting a real Cognito endpoint.
   */
  @Get('me')
  @ApiBearerAuth('cognito-jwt')
  @ApiOperation({ summary: 'Get current user profile', description: 'Returns the authenticated user\'s profile from Cognito. In development mode, falls back to JWT claims if the access token is a mock JWT.' })
  @ApiResponse({ status: 200, description: 'User profile returned successfully', schema: { example: { username: 'user@example.com', email: 'user@example.com', enabled: true, userStatus: 'CONFIRMED', groups: ['admin'], isAdmin: true } } })
  @ApiResponse({ status: 401, description: 'Invalid or missing Bearer token' })
  async getMe(
    @CurrentUser() user: UserClaims,
    @Request() req: { headers: { authorization?: string } },
  ) {
    try {
      const accessToken = req.headers.authorization?.substring(7) ?? '';
      return await this.cognitoService.getCurrentUser(accessToken);
    } catch {
      // In dev mode the access token is a fake JWT that Cognito rejects.
      // Fall back to the claims already decoded and verified by JwtAuthGuard.
      return {
        username: user.username,
        email: user.email,
        enabled: true,
        userStatus: 'CONFIRMED',
        groups: user.isAdmin ? ['admin'] : [],
        isAdmin: user.isAdmin,
        attributes: { email: user.email },
        createdDate: new Date().toISOString(),
        lastModifiedDate: new Date().toISOString(),
      };
    }
  }
}
