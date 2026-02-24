import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CompletePasswordChangeDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  session!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
