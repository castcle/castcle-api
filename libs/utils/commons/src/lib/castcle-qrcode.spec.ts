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

import { CastcleQRCode } from './castcle-qrcode';

describe('#CastcleQRCode', () => {
  describe('generateQRCodeText', () => {
    it('should create qrcode standard is correct.', async () => {
      const qrcodeText = await CastcleQRCode.generateQRCodeText([
        'test',
        'test',
        'test',
      ]);

      expect(qrcodeText).toEqual('test|test|test');
    });
  });

  describe('generateQRCodeStandard', () => {
    beforeAll(async () => {
      jest.spyOn(CastcleQRCode, 'generateQRCodeStandard').mockResolvedValue({
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAAN',
        medium: 'data:image/png;base64,iVBORw0KGgoAAAAN',
        large: 'data:image/png;base64,iVBORw0KGgoAAAAN',
      });
    });
    it('should create qrcode standard is correct.', async () => {
      const createQRCode = await CastcleQRCode.generateQRCodeStandard('test');

      expect(createQRCode.thumbnail).toMatch(/base64/g);
      expect(createQRCode.medium).toMatch(/base64/g);
      expect(createQRCode.large).toMatch(/base64/g);
    });
  });

  describe('generateQRCodeExport', () => {
    beforeAll(async () => {
      jest.spyOn(CastcleQRCode, 'generateQRCodeExport').mockResolvedValue({
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAAN',
        medium: 'data:image/png;base64,iVBORw0KGgoAAAAN',
        large: 'data:image/png;base64,iVBORw0KGgoAAAAN',
      });
    });
    it('should create qrcode standard is correct.', async () => {
      const createQRCodeExport = await CastcleQRCode.generateQRCodeExport(
        'data:image/png;base64,iVBORw0KGgoAAAAN',
        'test',
      );

      expect(createQRCodeExport.thumbnail).toMatch(/base64/g);
      expect(createQRCodeExport.medium).toMatch(/base64/g);
      expect(createQRCodeExport.large).toMatch(/base64/g);
    });
  });
});
