import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsAfterDate', async: false })
export class IsAfterDate implements ValidatorConstraintInterface {
  validate(endDate: string, startDate: ValidationArguments) {
    return endDate >= startDate.object[startDate.constraints[0]];
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be after ${args.constraints[0]}`;
  }
}

@ValidatorConstraint({ name: 'IsLessthanOrEqual', async: false })
export class IsLessthanOrEqual implements ValidatorConstraintInterface {
  validate(propertyValue: string, paramsToEqualValue: ValidationArguments) {
    return (
      propertyValue <=
      paramsToEqualValue.object[paramsToEqualValue.constraints[0]]
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be less or equal than ${args.constraints[0]}`;
  }
}
