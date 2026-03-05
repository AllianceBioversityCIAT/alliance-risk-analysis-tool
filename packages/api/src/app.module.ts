import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './platform/auth/auth.module';
import { AdminModule } from './platform/admin/admin.module';
import { PromptsModule } from './platform/prompts/prompts.module';
import { JobsModule } from './platform/jobs/jobs.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AssessmentsModule } from './domain/assessments/assessments.module';
import { GapDetectionModule } from './domain/gap-detection/gap-detection.module';
import { RiskAnalysisModule } from './domain/risk-analysis/risk-analysis.module';
import { ReportModule } from './domain/report/report.module';
import { TextractModule } from './infrastructure/textract/textract.module';
import { CognitoService } from './platform/auth/cognito.service';
import { JwtAuthGuard, COGNITO_VERIFIER } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 minute window
      limit: 30,   // 30 requests per minute per IP
    }]),
    DatabaseModule,
    AuthModule,
    AdminModule,
    PromptsModule,
    JobsModule,
    StorageModule,
    AssessmentsModule,
    GapDetectionModule,
    RiskAnalysisModule,
    ReportModule,
    TextractModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: COGNITO_VERIFIER,
      useExisting: CognitoService,
    },
  ],
})
export class AppModule {}
