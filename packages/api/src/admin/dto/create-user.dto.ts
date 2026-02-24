import { IsEmail, IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsBoolean()
  @IsOptional()
  sendWelcomeEmail?: boolean;
}
