import { Controller, Get, Put, Post, Body, Param } from '@nestjs/common';
import { GapDetectionService } from './gap-detection.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateGapFieldsDto } from './dto';

interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

@Controller('assessments/:id/gap-fields')
export class GapFieldController {
  constructor(private readonly gapDetectionService: GapDetectionService) {}

  @Get()
  findByAssessment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gapDetectionService.findByAssessment(id, user.id);
  }

  @Put()
  updateBatch(
    @Param('id') id: string,
    @Body() dto: UpdateGapFieldsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gapDetectionService.updateBatch(id, dto, user.id);
  }

  @Post('submit')
  triggerRiskAnalysis(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gapDetectionService.triggerRiskAnalysis(id, user.id);
  }
}
