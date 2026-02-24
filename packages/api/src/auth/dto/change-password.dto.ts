import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  previousPassword!: string;

  @IsString()
  @MinLength(8)
  proposedPassword!: string;
}
