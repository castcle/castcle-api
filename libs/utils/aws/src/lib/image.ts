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
import { Environment as env } from '@castcle-api/environments';
import * as AWS from 'aws-sdk';
import * as Configs from '../config';
import { Uploader, UploadOptions } from './uploader';

export class Image {
  constructor(public uri: string, public order?: number) {}

  toSignUrl() {
    const buff = Buffer.from(env.cloudfront_private_key, 'base64');
    const cloudFrontPrivateKey = buff.toString('ascii');
    const signer = new AWS.CloudFront.Signer(
      env.cloudfront_access_key_id
        ? env.cloudfront_access_key_id
        : 'testCloudKey',
      cloudFrontPrivateKey
    );

    return signer.getSignedUrl({
      url: `${
        env.assets_host ? env.assets_host : 'https://assets-dev.castcle.com'
      }/${this.uri}`,
      expires: Math.floor((Date.now() + Configs.EXPIRE_TIME) / 1000)
    });
  }

  /**
   * Get signurl of s3uri will return defaultImage if s3Uri is undefined and return undefined if no defaultImage
   * @param s3Uri
   * @param defaultImage
   * @returns
   */
  static download(s3Uri: string, defaultImage?: string) {
    if (s3Uri) {
      const image = new Image(s3Uri);
      return image.toSignUrl();
    } else if (defaultImage) {
      return defaultImage;
    } else return undefined;
  }

  static upload(base64: string, options?: UploadOptions) {
    const uploader = new Uploader(
      env.assets_bucket_name ? env.assets_bucket_name : 'testBucketName',
      Configs.IMAGE_BUCKET_FOLDER
    );
    const contentType = Uploader.getImageContentType(base64);
    return uploader
      .uploadFromBase64ToS3(base64, { ...options, contentType: contentType })
      .then((data) => new Image(data.Key, options.order));
  }
}
