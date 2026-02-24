import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PromptsModule } from './prompts/prompts.module';
import { JobsModule } from './jobs/jobs.module';
import { CognitoService } from './auth/cognito.service';
import { JwtAuthGuard, COGNITO_VERIFIER } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    PromptsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: COGNITO_VERIFIER,
      useExisting: CognitoService,
    },
  ],
})
export class AppModule {}
