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

import { CastcleRegExp } from './regexp';

describe('CastcleRegExp', () => {
  describe('PASSWORD_PATTERN', () => {
    it('should return false if length is less than 6 characters', () => {
      const text = '2@He';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only numbers', () => {
      const text = '123456';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only capital letters', () => {
      const text = 'ABCDEF';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only small letters', () => {
      const text = 'abcdef';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only numbers and capital letters', () => {
      const text = '123DEF';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only numbers and small letters', () => {
      const text = '123def';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return false if has minimum 6 characters, contains only small and capital letters', () => {
      const text = 'abcDEF';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeFalsy();
    });

    it('should return true if has minimum 6 characters, at least 1 capital letter, 1 small letter and 1 number', () => {
      const text = '2helloWorld';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeTruthy();
    });

    it('should return true if has minimum 6 characters, at least 1 capital letter, 1 small letter, 1 number and 1 special character', () => {
      const text = '2@HelloWorld';
      expect(CastcleRegExp.PASSWORD_PATTERN.test(text)).toBeTruthy();
    });
  });
});
