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

const saltRounds = 10;

const generate = async (password: string) => bcrypt.hash(password, saltRounds);

const validate = (password: string) => {
  //Minimum eight characters, at least one letter, one number and one special character
  return password.match(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{6,}$/)
    ? true
    : false;
};

const create = async (password: string) =>
  validate(password) ? generate(password) : null;

const verify = async (password: string, encryptPassword: string) =>
  bcrypt.compare(password, encryptPassword);

/**
 * random a number 0 - 9
 * @returns {number}
 */
const randomZeroToNine = () => {
  let randNumber = Math.floor(Math.random() * 10);
  if (randNumber === 10) randNumber = 9;
  return randNumber;
};

/**
 * Random X digits number
 * @param {number} digit
 * @returns {string}
 */
const generateRandomDigits = (digit: number) => {
  let refCode = '';
  for (let i = 0; i < digit; i++) refCode += randomZeroToNine();
  return refCode;
};

export const Password = {
  generate,
  create,
  verify,
  validate,
  generateRandomDigits,
};
