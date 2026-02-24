import { IsObject, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;
}
