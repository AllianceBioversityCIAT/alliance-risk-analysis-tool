import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserInfo } from '@alliance-risk/shared';
import type { Job } from '@prisma/client';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * GET /api/jobs/:id — Poll job status (authenticated)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserInfo,
  ): Promise<Job> {
    return this.jobsService.findOne(id, user.userId);
  }
}
