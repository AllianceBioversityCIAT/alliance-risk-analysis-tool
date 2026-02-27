import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  ListAssessmentsQueryDto,
  RequestUploadDto,
  CreateAssessmentCommentDto,
} from './dto';

import type { UserClaims } from '../common/guards/jwt-auth.guard';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.create(dto, user.userId);
  }

  @Get()
  findAll(
    @Query() query: ListAssessmentsQueryDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.findAll(user.userId, query);
  }

  @Get('stats')
  getStats(@CurrentUser() user: UserClaims) {
    return this.assessmentsService.getStats(user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.findOne(id, user.userId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.delete(id, user.userId);
  }

  @Post(':id/documents')
  requestUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestUploadDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.requestUploadUrl(id, dto, user.userId);
  }

  @Post(':id/documents/:documentId/parse')
  triggerParse(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.triggerParseDocument(id, documentId, user.userId);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssessmentCommentDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.addComment(id, dto, user.userId);
  }

  @Get(':id/comments')
  getComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.assessmentsService.getComments(id, user.userId);
  }
}
