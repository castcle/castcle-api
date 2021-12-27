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
import { CastcleName } from './castcle-name';
import { BANNED_NAMES, RESERVE_NAMES } from './configs/names';

describe('CastcleName', () => {
  describe('#convertToSlug()', () => {
    it('should remove all space and lower all character', () => {
      expect(CastcleName.convertToSlug('This Is Sparta')).toEqual(
        'thisissparta'
      );
    });
  });
  describe('#isBannedName()', () => {
    it('should return false if name is not in banned names', () => {
      expect(CastcleName.isBannedName('sompop')).toEqual(false);
    });
    it('should return true if name is  banned names', () => {
      expect(CastcleName.isBannedName(BANNED_NAMES[0])).toEqual(true);
    });
  });
  describe('#isReserveName()', () => {
    it('should return false if name is not in reserved names', () => {
      expect(CastcleName.isReserveName('sompop')).toEqual(false);
    });
    it('should return true if name is  banned names', () => {
      expect(CastcleName.isReserveName(RESERVE_NAMES[0])).toEqual(true);
    });
  });
  describe('#isValidName()', () => {
    it("should return true if name doest contain special character and when in slug it' in acceptable range", () => {
      expect(CastcleName.isValidName('sompop')).toEqual(true);
    });
    it('should return false if name contain any character', () => {
      expect(CastcleName.isValidName('@Abcr3')).toEqual(false);
      expect(CastcleName.isValidName('abv')).toEqual(false);
      expect(CastcleName.isValidName('abcde6789101112131415169')).toEqual(
        false
      );
    });
  });
  describe('#_preSuggest()', () => {
    it('should remove all special character', () => {
      expect(CastcleName._preSuggest('Abcd#5')).toEqual('Abcd5');
    });
  });
  describe('suggestCastcleId()', () => {
    it('should suggest _preSuggest name if _preSuggestName is valid', () => {
      expect(CastcleName.suggestCastcleId('Abcd#5')).toEqual('abcd5');
    });
    it('should generate random name if _preSuggest name is not valid', () => {
      expect(CastcleName.suggestCastcleId('ab5d')).not.toEqual('abd');
    });
  });
});
