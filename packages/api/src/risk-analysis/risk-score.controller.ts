import { Controller, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { RiskAnalysisService } from './risk-analysis.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateRecommendationDto } from './dto';
import type { UserClaims } from '../common/guards/jwt-auth.guard';

@Controller('assessments/:id')
export class RiskScoreController {
  constructor(private readonly riskAnalysisService: RiskAnalysisService) {}

  @Get('risk-scores')
  findByAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.riskAnalysisService.findByAssessment(id, user.userId);
  }

  @Put('recommendations/:recId')
  editRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recId') recId: string,
    @Body() dto: UpdateRecommendationDto,
    @CurrentUser() user: UserClaims,
  ) {
    return this.riskAnalysisService.editRecommendation(id, recId, dto, user.userId);
  }
}
