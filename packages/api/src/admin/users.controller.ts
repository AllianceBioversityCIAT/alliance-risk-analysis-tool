import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CognitoService } from '../auth/cognito.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Admin / Users')
@ApiBearerAuth('cognito-jwt')
@Controller('admin/users')
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * GET /api/admin/users
   * Returns a paginated list of all Cognito users.
   */
  @Get()
  @ApiOperation({ summary: 'List all users', description: 'Returns a cursor-paginated list of all Cognito users. Maximum 60 users per page (Cognito limit). Requires admin role.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of users per page (max 60, default 60)', example: 20 })
  @ApiQuery({ name: 'nextToken', required: false, type: String, description: 'Pagination cursor from the previous response' })
  @ApiResponse({ status: 200, description: 'Paginated user list returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async listUsers(
    @Query('limit') limit?: string,
    @Query('nextToken') nextToken?: string,
  ) {
    const parsedLimit = Math.min(limit ? parseInt(limit, 10) : 60, 60); // Cognito max is 60
    const result = await this.cognitoService.listUsers(parsedLimit, nextToken);
    return {
      data: {
        users: result.users,
        nextToken: result.paginationToken,
        total: result.users.length,
      },
    };
  }

  /**
   * POST /api/admin/users
   * Creates a new user in Cognito.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user', description: 'Creates a new user in Cognito with a temporary password. The user must change their password on first login (NEW_PASSWORD_REQUIRED challenge). Optionally sends a welcome email with login instructions.' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or email already exists' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.cognitoService.createUser(
      dto.email,
      dto.temporaryPassword,
      dto.sendWelcomeEmail,
    );
  }

  /**
   * GET /api/admin/users/:username
   * Returns details for a specific user.
   */
  @Get(':username')
  @ApiOperation({ summary: 'Get user by username', description: 'Returns full details for a specific Cognito user including attributes, status, groups, and account metadata.' })
  @ApiParam({ name: 'username', description: 'Cognito username (typically the email address or UUID sub)', example: 'user@example.com' })
  @ApiResponse({ status: 200, description: 'User details returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('username') username: string) {
    return this.cognitoService.getUser(username);
  }

  /**
   * PUT /api/admin/users/:username
   * Updates user attributes.
   */
  @Put(':username')
  @ApiOperation({ summary: 'Update user attributes', description: 'Updates one or more Cognito user attributes (e.g. email, name, custom attributes). Pass only the attributes you want to change.' })
  @ApiParam({ name: 'username', description: 'Cognito username to update', example: 'user@example.com' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated successfully', schema: { example: { message: 'User updated successfully.' } } })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(@Param('username') username: string, @Body() dto: UpdateUserDto) {
    await this.cognitoService.updateUser(username, dto.attributes ?? {});
    return { message: 'User updated successfully.' };
  }

  /**
   * DELETE /api/admin/users/:username
   * Deletes a user from Cognito.
   */
  @Delete(':username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user', description: 'Permanently deletes a user from Cognito. This action is irreversible.' })
  @ApiParam({ name: 'username', description: 'Cognito username to delete', example: 'user@example.com' })
  @ApiResponse({ status: 200, description: 'User deleted successfully', schema: { example: { message: 'User deleted successfully.' } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('username') username: string) {
    await this.cognitoService.deleteUser(username);
    return { message: 'User deleted successfully.' };
  }

  /**
   * POST /api/admin/users/:username/enable
   * Enables a disabled user.
   */
  @Post(':username/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable user', description: 'Re-enables a previously disabled Cognito user, restoring their ability to sign in.' })
  @ApiParam({ name: 'username', description: 'Cognito username to enable', example: 'user@example.com' })
  @ApiResponse({ status: 200, description: 'User enabled successfully', schema: { example: { message: 'User enabled successfully.' } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async enableUser(@Param('username') username: string) {
    await this.cognitoService.enableUser(username);
    return { message: 'User enabled successfully.' };
  }

  /**
   * POST /api/admin/users/:username/disable
   * Disables an active user.
   */
  @Post(':username/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable user', description: 'Disables a Cognito user, preventing them from signing in. Their account and data are preserved.' })
  @ApiParam({ name: 'username', description: 'Cognito username to disable', example: 'user@example.com' })
  @ApiResponse({ status: 200, description: 'User disabled successfully', schema: { example: { message: 'User disabled successfully.' } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async disableUser(@Param('username') username: string) {
    await this.cognitoService.disableUser(username);
    return { message: 'User disabled successfully.' };
  }

  /**
   * POST /api/admin/users/:username/reset-password
   * Sets a temporary password requiring change on next login.
   */
  @Post(':username/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin reset user password', description: 'Sets a new temporary password for the user. On next login, the user will be forced through the NEW_PASSWORD_REQUIRED challenge to set a permanent password.' })
  @ApiParam({ name: 'username', description: 'Cognito username whose password to reset', example: 'user@example.com' })
  @ApiBody({ schema: { type: 'object', required: ['temporaryPassword'], properties: { temporaryPassword: { type: 'string', example: 'TempP@ss123!', description: 'Temporary password (minimum 8 characters, must meet Cognito policy)' } } } })
  @ApiResponse({ status: 200, description: 'Password reset successfully', schema: { example: { message: 'Password reset successfully.' } } })
  @ApiResponse({ status: 400, description: 'Password does not meet Cognito policy requirements' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('username') username: string,
    @Body('temporaryPassword') temporaryPassword: string,
  ) {
    await this.cognitoService.resetUserPassword(username, temporaryPassword);
    return { message: 'Password reset successfully.' };
  }
}
