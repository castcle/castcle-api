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

import * as bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { CastcleRegExp } from './regexp';

const saltRounds = 10;

const hash = (password: string) => bcrypt.hashSync(password, saltRounds);

const validate = (password: string) => {
  return CastcleRegExp.PASSWORD_PATTERN.test(password);
};

const create = (password: string) =>
  validate(password) ? hash(password) : null;

const verify = (password: string, encryptPassword: string) =>
  bcrypt.compareSync(password, encryptPassword);

/**
 * Random X digits number
 * @param {number} digits
 */
const generateRandomDigits = (digits: number) => {
  return customAlphabet('1234567890')(digits);
};

export const Password = {
  create,
  generateRandomDigits,
  hash,
  validate,
  verify,
};
