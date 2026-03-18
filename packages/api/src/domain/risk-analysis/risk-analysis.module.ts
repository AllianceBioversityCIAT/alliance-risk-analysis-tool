import { Module } from '@nestjs/common';
import { RiskAnalysisService } from './risk-analysis.service';
import { RiskScoreController } from './risk-score.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { JobsModule } from '../../platform/jobs/jobs.module';

@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [RiskScoreController],
  providers: [RiskAnalysisService],
  exports: [RiskAnalysisService],
})
export class RiskAnalysisModule {}
