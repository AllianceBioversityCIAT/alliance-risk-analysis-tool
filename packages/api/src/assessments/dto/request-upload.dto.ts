import { IsString, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';

export class RequestUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(26214400) // 25 MB in bytes
  fileSize!: number;
}
