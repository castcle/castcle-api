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
import { Uploader } from './uploader';
describe('Uploader', () => {
  describe('#Uploader.getContentTypeFromFirstCharAt()', () => {
    it('should get png if char start with i', () => {
      expect(Uploader.getContentTypeFromFirstCharAt('i')).toEqual('png');
    });
    it('should get jpg if char start with /', () => {
      expect(Uploader.getContentTypeFromFirstCharAt('/')).toEqual('jpg');
    });
    it('should get gif if char start with R', () => {
      expect(Uploader.getContentTypeFromFirstCharAt('R')).toEqual('gif');
    });
    it('should get webp if char start with U', () => {
      expect(Uploader.getContentTypeFromFirstCharAt('i')).toEqual('png');
    });
    it('should get empty string if char start other character', () => {
      expect(Uploader.getContentTypeFromFirstCharAt('k')).toEqual('');
    });
  });
  describe('#Upload.getFileTypeFromBase64Prefix()', () => {
    it('should get content type after "data:image/{type};base54"', () => {
      expect(
        Uploader.getFileTypeFromBase64Prefix(
          'data:image/sompop;base64blablabla'
        )
      ).toEqual('sompop');
      expect(
        Uploader.getFileTypeFromBase64Prefix('data:video/mp4;base64blablabla')
      ).toEqual('mp4');
      expect(Uploader.getFileTypeFromBase64Prefix('blablabla')).toBeNull();
    });
  });
  describe('#Uploader.getImageContentType()', () => {
    it('should be able to get content type from prefix and first char of base64', () => {
      expect(
        Uploader.getImageContentType('data:image/sompop;base64blab')
      ).toEqual('image/sompop');
      expect(Uploader.getImageContentType('iTest')).toEqual('image/png');
      expect(Uploader.getImageContentType('blablabbla')).toEqual('image/jpeg');
    });
  });
  describe('#Uploader.getFileTypeFromBase64()', () => {
    it('should be able to get file type from prefix and first char of base64', () => {
      expect(
        Uploader.getFileTypeFromBase64('data:image/sompop;base64blab')
      ).toEqual('sompop');
      expect(Uploader.getFileTypeFromBase64('iTest')).toEqual('png');
    });
    it("should return '' if we dont know what file type it is", () => {
      expect(Uploader.getFileTypeFromBase64('blablabbla')).toEqual('');
    });
  });
  describe('#Uploader.getFileSavedNameFromOptions()', () => {
    it('should get fileName as set in options', () => {
      expect(
        Uploader.getFileSavedNameFromOptions('png', {
          filename: 'sompop-test',
        })
      ).toEqual('sompop-test.png');
    });
    it('should get subpath for fileName if set in options', () => {
      expect(
        Uploader.getFileSavedNameFromOptions('png', {
          filename: 'sompop-test',
          subpath: 'usera',
        })
      ).toEqual('usera/sompop-test.png');
    });
  });
});
