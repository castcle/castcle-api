import { CastcleRegExp } from '@castcle-api/utils/commons';
import { Matches } from 'class-validator';

export const CastcleId = () => {
  return Matches(CastcleRegExp.CASTCLE_ID_PATTERN, {
    message: 'The Castcle Id contains characters that are not allowed.',
  });
};
