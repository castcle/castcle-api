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
import { Environment } from '@castcle-api/environments';
import {
  QRCODE_EXPORT_SIZE_CONFIGS,
  QRCODE_STANDARD_SIZE_CONFIGS,
} from '@castcle-api/utils/aws';
import * as htmlPdf from 'html-pdf';
import * as QRCode from 'qrcode';
import * as sharp from 'sharp';

class ConfigQRCode {
  backgroundColor: string;
  castcleId: string;
  fontFamily: string;
  fontSize: string;
  height: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  title: string;
  width: string;
}
export class CastcleQRCode {
  private static configQRCode: ConfigQRCode = {
    backgroundColor: '#17191A',
    castcleId: 'Castcle ID',
    fontFamily: 'Sarabun sans-serif',
    fontSize: '54px',
    height: '720px',
    logo: 'https://s3.castcle.com/assets/castcle-logo-light.png',
    primaryColor: '#FFFFFF',
    secondaryColor: '#01D2FF',
    title: 'Castcle Decentralized Social Media',
    width: '1280px',
  };
  static async generateQRCodeStandard(inputText: string) {
    const standardQRCode = await Promise.all(
      QRCODE_STANDARD_SIZE_CONFIGS.map(async (size) => {
        return {
          [size.name]: await QRCode.toDataURL(inputText, {
            width: size.width,
            margin: 4,
          }),
        };
      }),
    );

    return Object.assign({}, ...standardQRCode);
  }
  static async generateQRCodeExport(inputQRCode: string, castcleId: string) {
    if (Environment.QR_THEME !== 'dark') {
      this.configQRCode = {
        ...this.configQRCode,
        backgroundColor: '#FFFFFF',
        logo: 'https://s3.castcle.com/assets/castcle-logo-dark.png',
        primaryColor: '#17191A',
        secondaryColor: '#01D2FF',
      };
    }

    console.log(this.configQRCode);

    const templateQRCodeExport = `
    <html>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun,Kanit&display=swap"
          rel="stylesheet" />
        <style>
          body {
            margin: 0;
            font-family: ${this.configQRCode.fontFamily};
            width: ${this.configQRCode.width};
            height: ${this.configQRCode.height};
          }
    
          h1 {
            color: ${this.configQRCode.primaryColor};
            font-size: ${this.configQRCode.fontSize};
            font-weight: 700;
            margin: 0;
          }
    
          .exports-wrapper {
            background-color: ${this.configQRCode.backgroundColor};
            padding: 72px;
          }
    
          .logo {
            width: 84.58px;
            height: 77.28px;
          }
    
          .qr-code {
            height: 427px;
            margin-top: 72px;
            width: 427px;
          }
    
          .title-label {
            margin: 0;
            padding-left: 32px;
          }
    
          .castcle-id-label {
            margin-top: 72px;
            padding-bottom: 15px;
            padding-left: 72px;
          }
    
          .castcle-id {
            color: ${this.configQRCode.secondaryColor};
            display: -webkit-box;
            font-weight: 400;
            overflow: hidden;
            padding-left: 72px;
            text-overflow: ellipsis;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="exports-wrapper">
          <table cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <img
                  class="logo"
                  src="${this.configQRCode.logo}"
                  alt="Castcle logo"
                />
              </td>
              <td class="title-label">
                <h1>${this.configQRCode.title}</h1>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <table cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <img
                        class="qr-code"
                        src="${inputQRCode}"
                        alt="QRCode"
                      />
                    </td>
                    <td>
                      <h1 class="castcle-id-label">${this.configQRCode.castcleId}</h1>
                      <h1 class="castcle-id">@${castcleId}</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
    `;

    const exportBase64 = await new Promise((resolve) => {
      htmlPdf
        .create(templateQRCodeExport, {
          width: this.configQRCode.width,
          height: this.configQRCode.height,
          type: 'png',
          quality: '85',
          border: '0',
        })
        .toBuffer(async (err: string, buffer: Buffer) => {
          resolve(!err ? buffer.toString('base64') : undefined);
        });
    });

    if (!exportBase64) return;

    const buffer = Buffer.from(exportBase64 as string, 'base64');
    const sharpImage = sharp(buffer);
    const metaData = await sharpImage.metadata();
    const exportsQRCode = await Promise.all(
      QRCODE_EXPORT_SIZE_CONFIGS.map(async (size) => {
        const newImage = await sharpImage
          .resize(size.width, size.height)
          .toFormat(metaData.format, { quality: 100 })
          .toBuffer();
        return {
          [size.name]: `data:image/png;base64,${newImage.toString('base64')}`,
        };
      }),
    );

    return Object.assign({}, ...exportsQRCode);
  }
}
