import { Module } from '@nestjs/common';
import { RiskAnalysisService } from './risk-analysis.service';
import { RiskScoreController } from './risk-score.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RiskScoreController],
  providers: [RiskAnalysisService],
  exports: [RiskAnalysisService],
})
export class RiskAnalysisModule {}
