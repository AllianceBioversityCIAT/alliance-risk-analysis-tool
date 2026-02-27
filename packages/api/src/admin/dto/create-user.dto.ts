import { IsEmail, IsString, IsBoolean, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword!: string;

  @IsBoolean()
  @IsOptional()
  sendWelcomeEmail?: boolean;
}
