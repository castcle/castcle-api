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
};

export class Uploader {
  s3: AWS.S3;
  constructor(public bucket: string, public destination: string) {
    this.s3 = new AWS.S3();
  }

  uploadFromBase64ToS3 = async (base64: string, options?: UploadOptions) => {
    try {
      const buffer = Buffer.from(
        base64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
      const fileType = base64.match(/[^:/]\w+(?=;|,)/)[0]; //detect file type
      const extensionName =
        options && options.addTime
          ? `-${Date.now()}.${fileType}`
          : `.${fileType}`;
      const saveName =
        options && options.filename
          ? `${options.filename}${extensionName}`
          : `${Date.now()}`;
      console.log({
        Bucket: this.bucket,
        Body: buffer,
        ContentEncoding: 'base64',
        Key: `${this.destination}/${saveName}`
      });
      return this.s3
        .upload({
          Bucket: this.bucket,
          Body: buffer,
          ContentEncoding: 'base64',
          Key: `${this.destination}/${saveName}`
        })
        .promise();
    } catch (error) {
      const errorLanguage =
        options && options.language ? options.language : 'en';
      throw new CastcleException(CastcleStatus.UPLOAD_FAILED, errorLanguage);
    }
  };
}
