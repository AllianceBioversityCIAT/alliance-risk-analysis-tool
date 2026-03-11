import { Module } from '@nestjs/common';
import { GapDetectionService } from './gap-detection.service';
import { GapFieldController } from './gap-field.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { JobsModule } from '../../platform/jobs/jobs.module';
import { BedrockModule } from '../../infrastructure/bedrock/bedrock.module';

@Module({
  imports: [DatabaseModule, JobsModule, BedrockModule],
  controllers: [GapFieldController],
  providers: [GapDetectionService],
  exports: [GapDetectionService],
})
export class GapDetectionModule {}
