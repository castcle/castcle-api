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
import { Password } from './password';
describe('Password', () => {
  describe('#generate()', () => {
    it('should return encrypt password', async () => {
      const newPassword = await Password.generate('12345');
      expect(newPassword).toBeDefined();
      expect(Password).not.toEqual(newPassword);
    });
    it('should return encrypt password differently even the same password', async () => {
      const newPassword = await Password.generate('12345');
      const newPassword2 = await Password.generate('12345');
      expect(newPassword2 !== newPassword).toBe(true);
    });
  });
  describe('#create()', () => {
    it('should create and return encryptpassword if it pass the validation', async () => {
      const passPassword = '123456';
      console.log('before call #create()');
      const encryptPassword = await Password.create(passPassword);
      console.log('after call #create()');
      expect(encryptPassword).toBeDefined();
      //expect(typeof encryptPassword).toBe('string');
    });
    it('should be null if password is not pass validation', async () => {
      const notPassPassword = '123';
      const encryptPassword = await Password.create(notPassPassword);
      expect(encryptPassword).toBeNull();
    });
  });
  describe('#verify()', () => {
    it('should return true if password is correct', async () => {
      const passPassword = 'verify123456';
      const encryptPassword = await Password.generate(passPassword);
      expect(await Password.verify(passPassword, encryptPassword)).toBe(true);
    });
    it('should return false if password is incorrect', async () => {
      const passPassword = 'verify654321';
      const encryptPassword = await Password.generate(passPassword);
      expect(
        await Password.verify('thisisawrongpassword', encryptPassword)
      ).toBe(false);
    });
    it('should return true to P jul password Abcd1@34$ ', async () => {
      const encryptPassword =
        '$2a$10$LF1C5E//QPPvPMQTdAlBqO.r/3DyOvdwHLZMuVMzb3PToLf227J8m';
      const testPasswordPJul = await Password.create('Abcd1@34$');
      console.log(testPasswordPJul);
      expect(await Password.verify('Abcd1@34$', encryptPassword)).toBe(true);
    });
  });
  describe('#validate()', () => {
    it('should return true if password has at least 8 length', () => {
      const passPassword = '2@HelloWorld';
      const notPassPassword = '123';
      const notPassPassword2 = '12345678';
      const notPassPassword3 = 'abc1234567';
      expect(Password.validate(passPassword)).toBe(true);
      expect(Password.validate(notPassPassword)).toBe(false);
      expect(Password.validate(notPassPassword2)).toBe(false);
      expect(Password.validate(notPassPassword3)).toBe(false);
    });
  });
});
