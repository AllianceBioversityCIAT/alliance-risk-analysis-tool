import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CognitoService } from '../auth/cognito.service';
import { AdminGuard } from '../common/guards/admin.guard';

const ALLOWED_GROUPS = ['admin', 'user', 'viewer'];

@ApiTags('Admin / Groups')
@ApiBearerAuth('cognito-jwt')
@Controller('admin')
@UseGuards(AdminGuard)
export class GroupsController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * GET /api/admin/groups
   * Returns all Cognito groups.
   */
  @Get('groups')
  @ApiOperation({ summary: 'List all groups', description: 'Returns all Cognito user groups defined in the user pool. Allowed groups are: admin, user, viewer.' })
  @ApiResponse({ status: 200, description: 'Groups returned successfully', schema: { example: { data: { groups: [{ GroupName: 'admin', Description: 'Administrators' }, { GroupName: 'user', Description: 'Standard users' }] } } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async listGroups() {
    const groups = await this.cognitoService.listGroups();
    return { data: { groups } };
  }

  /**
   * POST /api/admin/users/:username/groups/:groupName
   * Adds a user to a Cognito group.
   */
  @Post('users/:username/groups/:groupName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add user to group', description: 'Adds a Cognito user to a group. Allowed groups: admin, user, viewer. Assigning the admin group grants full admin access to the API.' })
  @ApiParam({ name: 'username', description: 'Cognito username to add to the group', example: 'user@example.com' })
  @ApiParam({ name: 'groupName', description: 'Group name to add the user to', enum: ['admin', 'user', 'viewer'] })
  @ApiResponse({ status: 200, description: 'User added to group successfully', schema: { example: { message: "User added to group 'admin' successfully." } } })
  @ApiResponse({ status: 400, description: 'Invalid group name' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async addUserToGroup(
    @Param('username') username: string,
    @Param('groupName') groupName: string,
  ) {
    if (!ALLOWED_GROUPS.includes(groupName)) {
      throw new BadRequestException(`Invalid group: ${groupName}. Allowed: ${ALLOWED_GROUPS.join(', ')}`);
    }
    await this.cognitoService.addUserToGroup(username, groupName);
    return { message: `User added to group '${groupName}' successfully.` };
  }

  /**
   * DELETE /api/admin/users/:username/groups/:groupName
   * Removes a user from a Cognito group.
   */
  @Delete('users/:username/groups/:groupName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove user from group', description: 'Removes a Cognito user from a group. Removing from the admin group revokes admin access immediately on the next token refresh.' })
  @ApiParam({ name: 'username', description: 'Cognito username to remove from the group', example: 'user@example.com' })
  @ApiParam({ name: 'groupName', description: 'Group name to remove the user from', enum: ['admin', 'user', 'viewer'] })
  @ApiResponse({ status: 200, description: 'User removed from group successfully', schema: { example: { message: "User removed from group 'admin' successfully." } } })
  @ApiResponse({ status: 400, description: 'Invalid group name' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async removeUserFromGroup(
    @Param('username') username: string,
    @Param('groupName') groupName: string,
  ) {
    if (!ALLOWED_GROUPS.includes(groupName)) {
      throw new BadRequestException(`Invalid group: ${groupName}. Allowed: ${ALLOWED_GROUPS.join(', ')}`);
    }
    await this.cognitoService.removeUserFromGroup(username, groupName);
    return { message: `User removed from group '${groupName}' successfully.` };
  }
}
