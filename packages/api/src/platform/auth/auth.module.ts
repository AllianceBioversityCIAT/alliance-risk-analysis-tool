import { Module } from '@nestjs/common';
import { CognitoService } from './cognito.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [CognitoService],
  exports: [CognitoService],
})
export class AuthModule {}
