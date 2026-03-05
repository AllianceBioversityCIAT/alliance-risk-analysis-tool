import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssw0rd!', description: 'Current (existing) password of the authenticated user' })
  @IsString()
  @IsNotEmpty()
  previousPassword!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!', description: 'New password to set (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  proposedPassword!: string;
}
