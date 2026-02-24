import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateRecommendationDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
