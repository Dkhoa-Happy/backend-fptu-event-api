import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) {
      return true; // Let @IsOptional handle empty values
    }

    const date = new Date(value);
    const now = new Date();
    
    // Set now to start of day for comparison (only compare dates, not time)
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return date >= now;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} không được là ngày quá khứ`;
  }
}

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

