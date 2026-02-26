import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Key-value map of Cognito user attributes to update. Use standard Cognito attribute names (e.g. email, name, phone_number) or custom attributes (e.g. custom:role).',
    example: { email: 'updated@example.com', name: 'Jane Doe' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;
}
