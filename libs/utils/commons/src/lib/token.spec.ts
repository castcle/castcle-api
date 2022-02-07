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

import { Token } from './token';

describe('Token', () => {
  describe('#generateToken()', () => {
    it('should return string', () => {
      const result = Token.generateToken(
        { testPayload: 'yo' },
        'randomSecret',
        1000
      );
      expect(typeof result).toBe('string');
    });
    it('should return different token with the same payload and different secret', () => {
      const result1 = Token.generateToken(
        { testPayload: 'yo' },
        'randomSecret',
        1000
      );
      const result2 = Token.generateToken(
        { testPayload: 'yo' },
        'random2',
        1000
      );
      expect(result1 === result2).toBe(false);
    });
  });
  describe('#isTokenValid()', () => {
    it("should return true if secret is correct and it's not expired", () => {
      const secret = 'secret';
      const token = Token.generateToken({ whatsup: 'castcle' }, secret, 5);
      expect(Token.isTokenValid(token, secret)).toBe(true);
    });
    it('should return false if secret is not correct', () => {
      const secret = 'secret';
      const token = Token.generateToken({ whatsup: 'castcle' }, secret, 5);
      const wrongSecret = 'wrong';
      expect(Token.isTokenValid(token, wrongSecret)).toBe(false);
    });
    it('should return false if token is expire', async () => {
      const secret = 'secret';
      const timeoutSecond = 2;
      const token = Token.generateToken(
        { whatsup: 'castcle' },
        secret,
        timeoutSecond
      );
      expect(Token.isTokenValid(token, secret)).toBe(true);
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, timeoutSecond * 1000);
      });
      expect(Token.isTokenValid(token, secret)).toBe(false);
    });
  });
  describe('#isTokenExpire()', () => {
    it('should return true if token is expire', async () => {
      const secret = 'secret';
      const timeoutSecond = 2;
      const token = Token.generateToken(
        { whatsup: 'castcle' },
        secret,
        timeoutSecond
      );
      expect(Token.isTokenValid(token, secret)).toBe(true);
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, timeoutSecond * 1000);
      });
      expect(await Token.isTokenExpire(token, secret)).toBe(true);
    });
    it('should return false if token is not valid but not expire', async () => {
      const secret = 'secret';
      const timeoutSecond = 2;
      const token = Token.generateToken(
        { whatsup: 'castcle' },
        secret,
        timeoutSecond
      );
      const wrongSecret = 'wrongSecret';
      expect(await Token.isTokenExpire(token, wrongSecret)).toBe(false);
    });
    it('should return false if token is valid but not expire', async () => {
      const secret = 'secret';
      const timeoutSecond = 2;
      const token = Token.generateToken(
        { whatsup: 'castcle' },
        secret,
        timeoutSecond
      );
      expect(await Token.isTokenExpire(token, secret)).toBe(false);
    });
  });
});
