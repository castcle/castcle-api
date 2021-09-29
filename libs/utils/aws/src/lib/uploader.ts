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

import * as AWS from 'aws-sdk';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';

export type UploadOptions = {
  filename?: string;
  language?: string;
  addTime?: boolean;
  order?: number;
  contentDisposition?: string;
};

/**
 * return content type that could use as extention file / will return '' if not match any know files(png,jpg,gif and webp)
 * @param {string} char
 * @returns {string}
 */
const getContentTypeFromFirstCharAt = (char: string) => {
  if (char === 'i') return 'png';
  else if (char === '/') return 'jpg';
  else if (char === 'R') return 'gif';
  else if (char === 'U') return 'webp';
  return '';
};

/**
 * get content type to prefix of base64 for example data:image/png;base64,123v... will return png
 * @param base64
 * @returns
 */
const getFileTypeFromBase64Prefix = (base64: string) => {
  const matchResult = base64.match(/[^:/]\w+(?=;|,)/);
  if (matchResult) {
    return matchResult[0];
  } else return null;
};

export class Uploader {
  s3: AWS.S3;
  constructor(public bucket: string, public destination: string) {
    this.s3 = new AWS.S3();
  }

  /**
   * upload base64 to S3 serer by replace any prefix and find suitable extension file
   * @param {string} base64
   * @param {UploadOptions} options
   * @returns {AWS.S3.ManagedUpload.SendData}
   */
  uploadFromBase64ToS3 = async (base64: string, options?: UploadOptions) => {
    try {
      const replaceContent = base64.replace(/^data:\w+\/\w+;base64,/, '');
      const buffer = Buffer.from(replaceContent, 'base64');
      const fileTypeFromPrefixResult = getFileTypeFromBase64Prefix(base64);
      const fileType = fileTypeFromPrefixResult
        ? fileTypeFromPrefixResult
        : getContentTypeFromFirstCharAt(replaceContent.charAt(0));
      const extensionName =
        options && options.addTime
          ? `-${Date.now()}.${fileType}`
          : `.${fileType}`;
      const saveName =
        options && options.filename
          ? `${options.filename}${extensionName}`
          : `${Date.now()}.${fileType}`;
      return this.s3
        .upload({
          Bucket: this.bucket,
          Body: buffer,
          ContentEncoding: 'base64',
          Key: `${this.destination}/${saveName}`,
          ContentDisposition: options.contentDisposition
            ? options.contentDisposition
            : 'inline'
        })
        .promise();
    } catch (error) {
      const errorLanguage =
        options && options.language ? options.language : 'en';
      throw new CastcleException(CastcleStatus.UPLOAD_FAILED, errorLanguage);
    }
  };
}
