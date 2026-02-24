import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Optional,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserInfo } from '@alliance-risk/shared';
import { JobType } from '@alliance-risk/shared';
import { PromptsService } from './prompts.service';
import { CommentsService, CreateCommentDto } from './comments.service';
import { ChangeHistoryService } from './change-history.service';
import { JobsService } from '../jobs/jobs.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { ListPromptsQueryDto } from './dto/list-prompts-query.dto';
import { PromptPreviewDto } from './dto/prompt-preview.dto';

@Controller('admin/prompts')
@UseGuards(AdminGuard)
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly commentsService: CommentsService,
    private readonly changeHistoryService: ChangeHistoryService,
    private readonly jobsService: JobsService,
  ) {}

  // GET /api/admin/prompts/list
  @Get('list')
  async list(@Query() query: ListPromptsQueryDto) {
    const result = await this.promptsService.findAll(query);
    return { data: result };
  }

  // POST /api/admin/prompts/create
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePromptDto, @CurrentUser() user: UserInfo) {
    const prompt = await this.promptsService.create(dto, user.userId);
    return { data: prompt };
  }

  // POST /api/admin/prompts/preview — async via JobsService
  @Post('preview')
  @HttpCode(HttpStatus.ACCEPTED)
  async preview(@Body() dto: PromptPreviewDto, @CurrentUser() user: UserInfo) {
    const jobId = await this.jobsService.create(JobType.AI_PREVIEW, dto, user.userId);
    return { data: { jobId, status: 'PROCESSING' } };
  }

  // GET /api/admin/prompts/:id
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('version', new ParseIntPipe({ optional: true })) @Optional() version?: number,
  ) {
    const prompt = await this.promptsService.findOne(id, version);
    return { data: prompt };
  }

  // PUT /api/admin/prompts/:id/update
  @Put(':id/update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromptDto,
    @CurrentUser() user: UserInfo,
  ) {
    const prompt = await this.promptsService.update(id, dto, user.userId);
    return { data: prompt };
  }

  // DELETE /api/admin/prompts/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserInfo,
    @Query('version', new ParseIntPipe({ optional: true })) @Optional() version?: number,
  ) {
    await this.promptsService.delete(id, user.userId, version);
  }

  // POST /api/admin/prompts/:id/toggle-active
  @Post(':id/toggle-active')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: UserInfo) {
    const prompt = await this.promptsService.toggleActive(id, user.userId);
    return { data: prompt };
  }

  // POST /api/admin/prompts/:id/comments
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: UserInfo,
  ) {
    const comment = await this.commentsService.addComment(id, dto, user.userId);
    return { data: comment };
  }

  // GET /api/admin/prompts/:id/comments
  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    const comments = await this.commentsService.getComments(id);
    return { data: comments };
  }

  // GET /api/admin/prompts/:id/history
  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    const history = await this.changeHistoryService.getHistory(id);
    return { data: history };
  }
}
