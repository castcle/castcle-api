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

import { plainToClass } from 'class-transformer';
import {
  TransformStringToArrayOfStrings,
  TransformStringToEnum,
} from './transformers';

describe('TransformStringToArrayOfStrings', () => {
  class Target {
    @TransformStringToArrayOfStrings()
    fields: string[];
  }

  it('should return array of strings if input with string', () => {
    const object = { fields: 'short' };
    const target = plainToClass(Target, object);

    expect(target).toMatchObject({ fields: ['short'] });
  });

  it('should return array of strings if input with string and separate with comma', () => {
    const object = { fields: 'short,long' };
    const target = plainToClass(Target, object);

    expect(target).toMatchObject({ fields: ['short', 'long'] });
  });

  it(`should return the value of input if it isn't a string`, () => {
    const object = { fields: 1 };
    const target = plainToClass(Target, object);

    expect(target).toMatchObject(object);
  });
});

describe('TransformStringToEnum', () => {
  enum TargetType {
    Short = 'short',
  }

  class Target {
    @TransformStringToEnum(TargetType)
    type: TargetType;
  }

  it('should return type if it contained in TargetType', () => {
    const object = { type: 'short' };
    const target = plainToClass(Target, object);

    expect(target).toMatchObject(object);
  });

  it(`should return undefined if it does not exist`, () => {
    const object = { type: 'other' };
    const target = plainToClass(Target, object);

    expect(target).toMatchObject({ type: undefined });
  });
});
