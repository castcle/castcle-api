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

import { Transform, TransformFnParams } from 'class-transformer';
import { isEnum, isString } from 'class-validator';

const stringToArrayOfStrings = ({ value }: TransformFnParams) => {
  return isString(value) ? value.split(',') : value;
};

export const TransformStringToArrayOfStrings = () => {
  return Transform(stringToArrayOfStrings, { toClassOnly: true });
};

const stringToEnum = (T: any) => {
  return ({ value }: TransformFnParams) => {
    return isEnum(value, T) ? value : undefined;
  };
};

export const TransformStringToEnum = (T: any) => {
  return Transform(stringToEnum(T), { toClassOnly: true });
};

const stringToObjectOfStrings = ({ value }: TransformFnParams) => {
  const sortByPattern = /(desc|asc)\(([\w.]+)\)/;
  const sorts = (value as string)?.split(',').map((sortStr) => {
    const [sortDirection, sortKey] = sortStr.match(sortByPattern).slice(1);

    return { [sortKey]: sortDirection === 'asc' ? 1 : -1 };
  });

  return Object.assign({}, ...sorts);
};

export const TransformSortStringToSortObject = () => {
  return Transform(stringToObjectOfStrings, { toClassOnly: true });
};

const removeLeadingZero = ({ value }: TransformFnParams) => {
  return (value as string)?.replace(/^0/, '');
};

export const RemoveLeadingZero = () => {
  return Transform(removeLeadingZero, { toClassOnly: true });
};

const stringToKeyword = ({ value }: TransformFnParams) => {
  if (!isString(value)) return undefined;
  if (value.charAt(0) === '@')
    return { input: value.slice(1), type: 'mention' };
  if (value.charAt(0) === '#')
    return { input: value.slice(1), type: 'hashtag' };
  return { input: value.trim(), type: 'word' };
};

export const TransformStringToKeyword = () => {
  return Transform(stringToKeyword, { toClassOnly: true });
};
