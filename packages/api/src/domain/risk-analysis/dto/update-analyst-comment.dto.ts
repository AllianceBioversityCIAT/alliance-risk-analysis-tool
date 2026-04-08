import { IsString, MaxLength } from 'class-validator';

export class UpdateAnalystCommentDto {
  @IsString()
  @MaxLength(10000)
  comment!: string;
}
