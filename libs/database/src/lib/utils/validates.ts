import { CastcleRegExp } from '@castcle-api/utils/commons';
import { applyDecorators } from '@nestjs/common';
import { Matches, MaxLength } from 'class-validator';

export const CastcleId = () => {
  return applyDecorators(
    Matches(CastcleRegExp.CASTCLE_ID_PATTERN, {
      message: 'The Castcle Id contains characters that are not allowed.',
    }),
    MaxLength(CastcleRegExp.CASTCLE_ID_MAX_LENGTH, {
      message: 'The Castcle Id must be shorter than or equal to 30 characters',
    }),
  );
};

export const PasswordPattern = () => {
  return applyDecorators(
    Matches(CastcleRegExp.PASSWORD_PATTERN, {
      message: 'The password contains characters that are not allowed.',
    }),
  );
};
