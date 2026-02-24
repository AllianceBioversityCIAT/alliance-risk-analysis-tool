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
import { CognitoService } from '../auth/cognito.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * GET /api/admin/users
   * Returns a paginated list of all Cognito users.
   */
  @Get()
  async listUsers(
    @Query('limit') limit?: string,
    @Query('paginationToken') paginationToken?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 60;
    return this.cognitoService.listUsers(parsedLimit, paginationToken);
  }

  /**
   * POST /api/admin/users
   * Creates a new user in Cognito.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async getUser(@Param('username') username: string) {
    return this.cognitoService.getUser(username);
  }

  /**
   * PUT /api/admin/users/:username
   * Updates user attributes.
   */
  @Put(':username')
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
  async resetPassword(
    @Param('username') username: string,
    @Body('temporaryPassword') temporaryPassword: string,
  ) {
    await this.cognitoService.resetUserPassword(username, temporaryPassword);
    return { message: 'Password reset successfully.' };
  }
}
