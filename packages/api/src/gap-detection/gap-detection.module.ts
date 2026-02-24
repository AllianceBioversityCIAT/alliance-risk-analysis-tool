import { Module } from '@nestjs/common';
import { GapDetectionService } from './gap-detection.service';
import { GapFieldController } from './gap-field.controller';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [GapFieldController],
  providers: [GapDetectionService],
  exports: [GapDetectionService],
})
export class GapDetectionModule {}
