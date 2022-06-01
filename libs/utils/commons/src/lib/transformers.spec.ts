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
  RemoveLeadingZero,
  TransformSortStringToSortObject,
  TransformStringToArrayOfStrings,
  TransformStringToEnum,
  TransformStringToKeyword,
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

describe('TransformSortStringToSortObject', () => {
  class Target {
    @TransformSortStringToSortObject()
    sortBy: string;
  }

  it('should return type if it contained in TargetType', () => {
    const sortString = { sortBy: 'desc(createdAt),asc(updatedAt)' };
    const target = plainToClass(Target, sortString);

    expect(target).toMatchObject({ sortBy: { createdAt: -1, updatedAt: 1 } });
  });

  it(`should return undefined if it does not exist`, () => {
    const sortString = {};
    const target = plainToClass(Target, sortString);

    expect(target).toMatchObject({});
  });
});

describe('RemoveLeadingZero', () => {
  class Target {
    @RemoveLeadingZero()
    mobileNumber: string;
  }

  it('should remove leading zero in mobile number', () => {
    const sortString = { mobileNumber: '0801231234' };
    const target = plainToClass(Target, sortString);

    expect(target).toMatchObject({ mobileNumber: '801231234' });
  });

  it(`should return the original mobile number if no leading zero in mobile number`, () => {
    const sortString = { mobileNumber: '801231234' };
    const target = plainToClass(Target, sortString);

    expect(target).toMatchObject({ mobileNumber: '801231234' });
  });

  it(`should return if value is null or undefined`, () => {
    const sortString = {};
    const target = plainToClass(Target, sortString);

    expect(target).toMatchObject({});
  });
});

describe('TransformStringToKeyword', () => {
  class Target {
    @TransformStringToKeyword()
    keyword: string;
  }

  it('should return type mention', () => {
    const keywordString = { keyword: '@mention' };
    const target = plainToClass(Target, keywordString);

    expect(target).toMatchObject({
      keyword: { input: 'mention', type: 'mention' },
    });
  });

  it('should return type hashtag', () => {
    const keywordString = { keyword: '#hashtag' };
    const target = plainToClass(Target, keywordString);

    expect(target).toMatchObject({
      keyword: { input: 'hashtag', type: 'hashtag' },
    });
  });

  it('should return type word', () => {
    const keywordString = { keyword: 'word' };
    const target = plainToClass(Target, keywordString);

    expect(target).toMatchObject({
      keyword: { input: 'word', type: 'word' },
    });
  });
});
