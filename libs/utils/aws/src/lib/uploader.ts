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
  contentType?: string;
  subpath?: string;
  suffix?: string;
};

export class Uploader {
  s3: AWS.S3;
  constructor(public bucket: string, public destination: string) {
    this.s3 = new AWS.S3();
  }

  /**
   * return content type that could use as extention file / will return '' if not match any know files(png,jpg,gif and webp)
   * @param {string} char
   * @returns {string}
   */
  static getContentTypeFromFirstCharAt = (char: string) => {
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
  static getFileTypeFromBase64Prefix = (base64: string) => {
    const matchResult = base64.match(/[^:/]\w+(?=;|,)/);
    if (matchResult) {
      return matchResult[0];
    } else return null;
  };

  /**
   * get image content type for base64 file all the result will start with images/{fileType}
   * @param {string} base64
   * @returns {string}
   */
  static getImageContentType = (base64: string) => {
    const prefixType = Uploader.getFileTypeFromBase64Prefix(base64);
    if (prefixType) return `image/${prefixType}`;
    const replaceContent = base64.replace(/^data:\w+\/\w+;base64,/, '');
    const fileType = Uploader.getContentTypeFromFirstCharAt(
      replaceContent.charAt(0)
    );
    if (fileType === '') return 'image/jpeg';
    //should not happen
    else return `image/${fileType}`;
  };

  /**
   * get Buffer from base64
   * @param {string} base64
   * @returns {Buffer}
   */
  static getBufferFromBase64 = (base64: string) => {
    const replaceContent = base64.replace(/^data:\w+\/\w+;base64,/, '');
    const buffer = Buffer.from(replaceContent, 'base64');
    return buffer;
  };

  /**
   * get file type from base64
   * @param {string} base64
   * @returns {string}
   */
  static getFileTypeFromBase64 = (base64: string) => {
    const replaceContent = base64.replace(/^data:\w+\/\w+;base64,/, '');
    const fileTypeFromPrefixResult =
      Uploader.getFileTypeFromBase64Prefix(base64);
    return fileTypeFromPrefixResult
      ? fileTypeFromPrefixResult
      : Uploader.getContentTypeFromFirstCharAt(replaceContent.charAt(0));
  };

  /**
   * get file save name from fileType will check if there is subpath and will generate DateTime as timestamp for file if there is no name
   * @param fileType
   * @param options
   * @returns
   */
  static getFileSavedNameFromOptions = (
    fileType: string,
    options?: UploadOptions
  ) => {
    const extensionName =
      options && options.addTime
        ? `-${Date.now()}.${fileType}`
        : `.${fileType}`;
    let saveName =
      options && options.filename ? `${options.filename}` : `${Date.now()}`;
    if (options.suffix) saveName = saveName + `-${options.suffix}`;
    saveName = saveName + extensionName;
    if (options.subpath) saveName = `${options.subpath}/${saveName}`;
    return saveName;
  };

  /**
   * upload buffer to S3 with file type and subpath in options
   * @param {Buffer} buffer
   * @param {string} fileType
   * @param {UploadOptions} options
   * @returns
   */
  uploadBufferToS3 = async (
    buffer: Buffer,
    fileType: string,
    options?: UploadOptions
  ) => {
    try {
      const saveName = Uploader.getFileSavedNameFromOptions(fileType, options);
      //console.debug('saveName', saveName);
      //console.debug('bucket', this.bucket);
      //console.debug('key', `${this.destination}/${saveName}`);

      return this.s3
        .upload({
          Bucket: this.bucket,
          Body: buffer,
          Key: `${this.destination}/${saveName}`,
          ContentType: options.contentType,
        })
        .promise();
    } catch (error) {
      const errorLanguage =
        options && options.language ? options.language : 'en';
      throw new CastcleException(CastcleStatus.UPLOAD_FAILED, errorLanguage);
    }
  };

  /**
   * upload base64 to S3 serer by replace any prefix and find suitable extension file
   * @param {string} base64
   * @param {UploadOptions} options
   * @returns {AWS.S3.ManagedUpload.SendData}
   */
  uploadFromBase64ToS3 = async (base64: string, options?: UploadOptions) => {
    const buffer = Uploader.getBufferFromBase64(base64);
    const fileType = Uploader.getFileTypeFromBase64(base64);
    return this.uploadBufferToS3(buffer, fileType, options);
  };
}
