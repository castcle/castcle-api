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
import { Size, Image } from './image';
describe('Image Unit Test', () => {
  describe('#_getNewSameRatioSize()', () => {
    it('should resize stuff with the same ratio ', () => {
      const fixSize: Size = {
        name: 'test',
        width: 200,
        height: 200,
      };
      const newSize = Image._getNewSameRatioSize(500, 200, fixSize);
      expect(newSize.name).toEqual(fixSize.name);
      expect(newSize.width).toEqual(fixSize.width);
      expect(newSize.height).toEqual((200 / 500) * 200);
      const newSize2 = Image._getNewSameRatioSize(200, 500, fixSize);
      expect(newSize2.name).toEqual(fixSize.name);
      expect(newSize2.height).toEqual(fixSize.height);
      expect(newSize2.width).toEqual((200 / 500) * 200);
    });
    it('should not resize if the original is smaller than ratio', () => {
      const fixSize: Size = {
        name: 'test',
        width: 200,
        height: 200,
      };
      const newSize = Image._getNewSameRatioSize(140, 50, fixSize);
      expect(newSize.name).toEqual(fixSize.name);
      expect(newSize.width).toEqual(140);
      expect(newSize.height).toEqual(50);
    });
  });
});
