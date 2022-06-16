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
import { Size } from '@castcle-api/utils/aws';
import * as AWS from 'aws-sdk';
import { environment } from '../../environments/environment';
import * as Configs from '../config/config';
import { UploadOptions } from './uploader';

export interface ImageUploadOptions extends UploadOptions {
  sizes?: Size[];
}

export class Image {
  constructor(
    public image: {
      original: string;
      [key: string]: string;
    },
    public order?: number,
  ) {}

  toSignUrl(sizeName?: string) {
    if (!environment.CLOUDFRONT_PRIVATE_KEY) return this.image.original;
    const buff = Buffer.from(environment.CLOUDFRONT_PRIVATE_KEY, 'base64');
    const cloudFrontPrivateKey = buff.toString('ascii');
    const signer = new AWS.CloudFront.Signer(
      environment.CLOUDFRONT_ACCESS_KEY_ID
        ? environment.CLOUDFRONT_ACCESS_KEY_ID
        : 'testCloudKey',
      cloudFrontPrivateKey,
    );
    const imageUrl = sizeName ? this.image[sizeName] : this.image.original;
    const HTTPS_PATTERN = /^https?:\/\//;
    const url = HTTPS_PATTERN.test(imageUrl)
      ? imageUrl
      : `${environment.ASSETS_HOST}/${imageUrl}`;
    return signer.getSignedUrl({
      url,
      expires: Math.floor((Date.now() + Configs.EXPIRE_TIME) / 1000),
    });
  }

  toSignUrls() {
    if (this.image['isSign']) return this.image;
    const newImage: {
      original: string;
      [key: string]: string;
    } = {
      original: this.toSignUrl(),
    };
    Object.keys(this.image).forEach((sizeName) => {
      newImage[sizeName] = this.toSignUrl(sizeName);
    });
    newImage['isSign'] = 'signed'; //TODO !!! Hack
    return newImage;
  }

  /**
   * return a size with same ratio as original with the max of both width and height from maxSize
   * @param {number} originalWidth
   * @param {number} originalHeight
   * @param {Size} maxSize
   * @returns {Size}
   */
  static _getNewSameRatioSize = (
    originalWidth: number,
    originalHeight: number,
    maxSize: Size,
  ) => {
    const heightRatio = originalHeight / maxSize.height;
    const widthRatio = originalWidth / maxSize.width;
    const ratio = Math.max(heightRatio, widthRatio);
    if (ratio <= 1.0)
      return {
        name: maxSize.name,
        height: Math.floor(originalHeight),
        width: Math.floor(originalWidth),
      } as Size;
    return {
      name: maxSize.name,
      height: Math.floor(originalHeight / ratio),
      width: Math.floor(originalWidth / ratio),
    } as Size;
  };

  static download(
    image: {
      original: string;
      [key: string]: string;
    },
    defaultImage?: string,
  ): {
    original: string;
    [key: string]: string;
  } {
    if (image) {
      const imageInstance = new Image(image);
      return imageInstance.toSignUrls();
    } else if (defaultImage) {
      return {
        original: defaultImage,
      };
    } else return undefined;
  }
}
