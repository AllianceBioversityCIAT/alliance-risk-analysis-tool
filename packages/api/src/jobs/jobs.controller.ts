import { Controller, Get, Param, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JobsService } from './jobs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserInfo } from '@alliance-risk/shared';
import type { Job } from '@prisma/client';

@ApiTags('Jobs')
@ApiBearerAuth('cognito-jwt')
@SkipThrottle()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * GET /api/jobs/:id — Poll job status (authenticated)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get job status',
    description: 'Polls the status of an asynchronous background job (e.g. AI preview via Bedrock). Returns the job record including status and result payload. Poll every 3 seconds until status is COMPLETED or FAILED. Jobs are scoped to the requesting user — you cannot access other users\' jobs.',
  })
  @ApiParam({ name: 'id', description: 'Job UUID returned from the job-creating endpoint (e.g. POST /api/admin/prompts/preview)', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: 200,
    description: 'Job record returned successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'AI_PREVIEW',
        status: 'COMPLETED',
        result: { output: 'The main market risks identified are...' },
        error: null,
        createdAt: '2026-02-26T12:00:00.000Z',
        updatedAt: '2026-02-26T12:00:05.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 404, description: 'Job not found or does not belong to the requesting user' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserInfo,
  ): Promise<Job> {
    return this.jobsService.findOne(id, user.userId);
  }
}
