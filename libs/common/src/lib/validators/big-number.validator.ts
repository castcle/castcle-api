/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */

import { BigNumber } from 'bignumber.js';
import {
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint()
class IsBigNumberValidator implements ValidatorConstraintInterface {
  message: string;

  validate(value: any, validationArguments?: ValidationArguments) {
    const bn = BigNumber(value);

    if (!bn.isFinite()) {
      return this.setValidationError('$property should be number string');
    }

    const allowZero: boolean = validationArguments?.constraints?.[0];
    if (allowZero === false && bn.isZero()) {
      return this.setValidationError('$property should not be zero');
    }

    const type: BigNumberType = validationArguments?.constraints?.[1];
    if (type === 'positive' && !bn.isPositive()) {
      return this.setValidationError('$property should be positive number');
    }
    if (type === 'negative' && !bn.isNegative()) {
      return this.setValidationError('$property should be negative number');
    }

    return true;
  }

  setValidationError(msg: string) {
    this.message = msg;
    return false;
  }

  defaultMessage() {
    return this.message;
  }
}

export type BigNumberType = 'positive' | 'negative';

export const IsBigNumber = (options?: {
  allowZero: boolean;
  type: BigNumberType;
}) => Validate(IsBigNumberValidator, [options?.allowZero, options?.type]);
