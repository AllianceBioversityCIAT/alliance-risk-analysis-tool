import { IsArray, IsString, IsNotEmpty, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class GapFieldUpdateItem {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @MaxLength(5000)
  correctedValue!: string;
}

export class UpdateGapFieldsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GapFieldUpdateItem)
  updates!: GapFieldUpdateItem[];
}
