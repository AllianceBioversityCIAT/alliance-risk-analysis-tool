import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address (case-insensitive, will be lowercased)' })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'MyP@ssw0rd!', description: 'User password (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
