import { Controller, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { RiskAnalysisService } from './risk-analysis.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateRecommendationDto } from './dto';

interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

@Controller('assessments/:id')
export class RiskScoreController {
  constructor(private readonly riskAnalysisService: RiskAnalysisService) {}

  @Get('risk-scores')
  findByAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.riskAnalysisService.findByAssessment(id, user.id);
  }

  @Put('recommendations/:recId')
  editRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recId') recId: string,
    @Body() dto: UpdateRecommendationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.riskAnalysisService.editRecommendation(id, recId, dto, user.id);
  }
}
