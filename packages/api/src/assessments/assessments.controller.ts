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

interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.create(dto, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListAssessmentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findAll(user.id, query);
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.assessmentsService.getStats(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.delete(id, user.id);
  }

  @Post(':id/documents')
  requestUploadUrl(
    @Param('id') id: string,
    @Body() dto: RequestUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.requestUploadUrl(id, dto, user.id);
  }

  @Post(':id/documents/:documentId/parse')
  triggerParse(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.triggerParseDocument(id, documentId, user.id);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateAssessmentCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.addComment(id, dto, user.id);
  }

  @Get(':id/comments')
  getComments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getComments(id, user.id);
  }
}
