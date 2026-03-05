import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Username or email address of the account to reset' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '123456', description: '6-digit verification code sent to the user\'s email by the forgot-password flow' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'New password (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
