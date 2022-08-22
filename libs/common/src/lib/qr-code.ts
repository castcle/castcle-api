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

import * as QRCode from 'qrcode';
import { CastcleLogger } from './logger';

const QR_CODE_STANDARD_SIZE_CONFIGS = [
  { name: 'thumbnail', width: 250, height: 250 },
  { name: 'medium', width: 690, height: 690 },
  { name: 'large', width: 1024, height: 1024 },
];

export class CastcleQRCode {
  private static logger = new CastcleLogger(CastcleQRCode.name);

  static generateQRCodeText(inputsText: string[]) {
    return inputsText ? inputsText.join('|') : null;
  }

  static async generateQRCode(inputText: string, size: string) {
    this.logger.log(`Generate QR Code size : ${size}`);

    const { width } = QR_CODE_STANDARD_SIZE_CONFIGS.find(
      ({ name }) => name === size,
    );

    return QRCode.toDataURL(inputText, {
      width: width,
      margin: 4,
    });
  }
}
