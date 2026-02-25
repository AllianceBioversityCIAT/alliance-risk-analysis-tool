import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateRecommendationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text!: string;
}
