import { IsEmail, IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'newuser@example.com', description: 'Email address for the new user (used as username, will be lowercased)' })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'TempP@ss123!', description: 'Temporary password (minimum 8 characters). The user must change this on first login.', minLength: 8 })
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @ApiPropertyOptional({ example: true, description: 'If true, Cognito sends a welcome email with login instructions to the new user. Defaults to false.' })
  @IsBoolean()
  @IsOptional()
  sendWelcomeEmail?: boolean;
}
