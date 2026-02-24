import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateAssessmentCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
