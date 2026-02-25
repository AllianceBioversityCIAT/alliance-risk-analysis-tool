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
import { CognitoService } from '../auth/cognito.service';
import { AdminGuard } from '../common/guards/admin.guard';

const ALLOWED_GROUPS = ['admin', 'user', 'viewer'];

@Controller('admin')
@UseGuards(AdminGuard)
export class GroupsController {
  constructor(private readonly cognitoService: CognitoService) {}

  /**
   * GET /api/admin/groups
   * Returns all Cognito groups.
   */
  @Get('groups')
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
