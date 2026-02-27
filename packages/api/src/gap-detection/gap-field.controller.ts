import { Controller, Get, Put, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { GapDetectionService } from './gap-detection.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateGapFieldsDto } from './dto';
import type { UserClaims } from '../common/guards/jwt-auth.guard';

@Controller('assessments/:id/gap-fields')
export class GapFieldController {
  constructor(private readonly gapDetectionService: GapDetectionService) {}

  @Get()
  findByAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.gapDetectionService.findByAssessment(id, user.userId);
  }

  @Put()
  updateBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGapFieldsDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.gapDetectionService.updateBatch(id, dto, user.userId);
  }

  @Post('submit')
  triggerRiskAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.gapDetectionService.triggerRiskAnalysis(id, user.userId);
  }
}
