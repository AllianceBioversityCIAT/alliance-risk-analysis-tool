import { IsArray, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GapFieldUpdateItem {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  correctedValue!: string;
}

export class UpdateGapFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GapFieldUpdateItem)
  updates!: GapFieldUpdateItem[];
}
