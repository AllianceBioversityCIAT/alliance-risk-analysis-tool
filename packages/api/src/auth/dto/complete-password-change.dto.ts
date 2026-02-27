import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CompletePasswordChangeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  username!: string;

  @IsString()
  @IsNotEmpty()
  session!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
