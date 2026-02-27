import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  previousPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  proposedPassword!: string;
}
