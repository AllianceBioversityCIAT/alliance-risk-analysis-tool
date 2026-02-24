import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { GroupsController } from './groups.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, GroupsController],
})
export class AdminModule {}
