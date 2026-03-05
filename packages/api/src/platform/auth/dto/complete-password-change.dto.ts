import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompletePasswordChangeDto {
  @ApiProperty({ example: 'user@example.com', description: 'Username returned in the NEW_PASSWORD_REQUIRED challenge from the login response' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'AYABe...', description: 'Session token returned in the NEW_PASSWORD_REQUIRED challenge from the login response' })
  @IsString()
  @IsNotEmpty()
  session!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'New permanent password to set (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
