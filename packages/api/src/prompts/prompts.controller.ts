import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
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
import { BulkImportDto } from './dto/bulk-import.dto';

@ApiTags('Prompts (Admin)')
@ApiBearerAuth('cognito-jwt')
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
  @ApiOperation({ summary: 'List prompts', description: 'Returns a paginated list of AI prompts with optional filtering by section, route, tag, search term, and active status.' })
  @ApiResponse({ status: 200, description: 'Paginated prompt list returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async list(@Query() query: ListPromptsQueryDto) {
    const result = await this.promptsService.findAll(query);
    return { data: result };
  }

  // POST /api/admin/prompts/create
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create prompt', description: 'Creates a new AI prompt. A version snapshot (v1) is automatically created. The prompt is inactive by default unless isActive is explicitly set to true.' })
  @ApiBody({ type: CreatePromptDto })
  @ApiResponse({ status: 201, description: 'Prompt created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async create(@Body() dto: CreatePromptDto, @CurrentUser() user: UserInfo) {
    const prompt = await this.promptsService.create(dto, user.userId);
    return { data: prompt };
  }

  // GET /api/admin/prompts/export
  @Get('export')
  @ApiOperation({ summary: 'Export all prompts', description: 'Exports all prompts as JSON or CSV file attachment.' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'], description: 'Export format (default: json)' })
  @ApiResponse({ status: 200, description: 'File download' })
  async exportAll(
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ) {
    const prompts = await this.promptsService.exportAll();
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const headers = ['id', 'name', 'section', 'subSection', 'route', 'categories', 'tags', 'version', 'isActive', 'systemPrompt', 'userPromptTemplate', 'tone', 'outputFormat', 'createdAt', 'updatedAt'];
      const csvRows = [headers.join(',')];
      for (const p of prompts) {
        const row = headers.map((h) => {
          const val = (p as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          if (Array.isArray(val)) return `"${val.join(';')}"`;
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        });
        csvRows.push(row.join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="prompts-${timestamp}.csv"`);
      return res.send(csvRows.join('\n'));
    }

    // Default: JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="prompts-${timestamp}.json"`);
    return res.json({ data: prompts });
  }

  // POST /api/admin/prompts/import
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk import prompts', description: 'Imports prompts from a JSON payload. Supports create_new (skip existing) and upsert (update matching) modes.' })
  @ApiBody({ type: BulkImportDto })
  @ApiResponse({ status: 200, description: 'Import results with created/updated/error counts' })
  async importBulk(@Body() dto: BulkImportDto, @CurrentUser() user: UserInfo) {
    const result = await this.promptsService.importBulk(dto, user.userId);
    return { data: result };
  }

  // POST /api/admin/prompts/preview — async via JobsService
  @Post('preview')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Preview prompt with AI', description: 'Submits a prompt for asynchronous AI preview via AWS Bedrock. Returns a jobId immediately. Poll GET /api/jobs/:id every 3 seconds until status is COMPLETED or FAILED.' })
  @ApiBody({ type: PromptPreviewDto })
  @ApiResponse({ status: 202, description: 'Preview job accepted — poll the returned jobId for results', schema: { example: { data: { jobId: '550e8400-e29b-41d4-a716-446655440000', status: 'PROCESSING' } } } })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async preview(@Body() dto: PromptPreviewDto, @CurrentUser() user: UserInfo) {
    const jobId = await this.jobsService.create(JobType.AI_PREVIEW, dto, user.userId);
    return { data: { jobId, status: 'PROCESSING' } };
  }

  // GET /api/admin/prompts/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get prompt by ID', description: 'Returns a single prompt by its UUID. Optionally retrieve a specific historical version by providing the version number.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'version', required: false, type: Number, description: 'Historical version number to retrieve (omit for current version)', example: 2 })
  @ApiResponse({ status: 200, description: 'Prompt returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async findOne(
    @Param('id') id: string,
    @Query('version') versionRaw?: string,
  ) {
    const version = this.parseOptionalInt(versionRaw, 'version');
    const prompt = await this.promptsService.findOne(id, version);
    return { data: prompt };
  }

  // PUT /api/admin/prompts/:id/update
  @Put(':id/update')
  @ApiOperation({ summary: 'Update prompt', description: 'Updates an existing prompt. A new version snapshot is automatically created on every update, preserving the full change history.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID to update', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({ type: UpdatePromptDto })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 409, description: 'Conflict — concurrent update detected' })
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
  @ApiOperation({ summary: 'Delete prompt', description: 'Deletes a prompt and all its version history. If a specific version number is provided, only that version snapshot is deleted.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID to delete', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'version', required: false, type: Number, description: 'If provided, deletes only this specific version snapshot rather than the entire prompt' })
  @ApiResponse({ status: 204, description: 'Prompt deleted successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserInfo,
    @Query('version') versionRaw?: string,
  ) {
    const version = this.parseOptionalInt(versionRaw, 'version');
    await this.promptsService.delete(id, user.userId, version);
  }

  // POST /api/admin/prompts/:id/toggle-active
  @Post(':id/toggle-active')
  @ApiOperation({ summary: 'Toggle prompt active state', description: 'Flips the isActive flag on a prompt. Only one prompt per section should be active at a time — activating one may deactivate others in the same section.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID to toggle', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Prompt active state toggled successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async toggleActive(@Param('id') id: string, @CurrentUser() user: UserInfo) {
    const prompt = await this.promptsService.toggleActive(id, user.userId);
    return { data: prompt };
  }

  // POST /api/admin/prompts/:id/comments
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add comment to prompt', description: 'Adds a threaded comment to a prompt. Comments support optional parent comment references for threading. Useful for collaborative review of prompts.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID to comment on', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({ schema: { type: 'object', required: ['content'], properties: { content: { type: 'string', example: 'This prompt needs more specific instructions for the gap detection step.' }, parentId: { type: 'string', format: 'uuid', description: 'UUID of parent comment for threaded replies (optional)' } } } })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
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
  @ApiOperation({ summary: 'Get prompt comments', description: 'Returns all comments for a prompt in chronological order, including threaded replies.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Comments returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async getComments(@Param('id') id: string) {
    const comments = await this.commentsService.getComments(id);
    return { data: comments };
  }

  // GET /api/admin/prompts/:id/history
  @Get(':id/history')
  @ApiOperation({ summary: 'Get prompt change history', description: 'Returns the full version history of a prompt, including diffs between versions, who made each change, and when. Useful for auditing and rollback decisions.' })
  @ApiParam({ name: 'id', description: 'Prompt UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Change history returned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async getHistory(@Param('id') id: string) {
    const history = await this.changeHistoryService.getHistory(id);
    return { data: history };
  }

  private parseOptionalInt(value: string | undefined, paramName: string): number | undefined {
    if (value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException(`Validation failed: ${paramName} must be an integer`);
    }
    return parsed;
  }
}
