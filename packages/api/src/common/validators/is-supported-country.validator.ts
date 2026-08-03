import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { SUPPORTED_COUNTRY_LABELS, isSupportedCountry } from '@alliance-risk/shared';

@ValidatorConstraint({ name: 'isSupportedCountry', async: false })
export class IsSupportedCountryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isSupportedCountry(value);
  }

  defaultMessage(): string {
    return `country must be one of: ${SUPPORTED_COUNTRY_LABELS.join(', ')}`;
  }
}

export function IsSupportedCountry(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSupportedCountryConstraint,
    });
  };
}
