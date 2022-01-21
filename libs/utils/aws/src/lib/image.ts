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
import * as sharp from 'sharp';
import * as Configs from '../config';
import { Uploader, UploadOptions } from './uploader';

const OriginalSuffix = 'original';

export type Size = {
  name: string;
  width: number;
  height: number;
};

export interface ImageUploadOptions extends UploadOptions {
  sizes?: Size[];
}

export class Image {
  constructor(
    public image: {
      original: string;
      [key: string]: string;
    },
    public order?: number
  ) {}

  toSignUrl(sizeName?: string) {
    //for pass no env test
    if (!env.CLOUDFRONT_PRIVATE_KEY) return this.image.original;
    const buff = Buffer.from(env.CLOUDFRONT_PRIVATE_KEY, 'base64');
    const cloudFrontPrivateKey = buff.toString('ascii');
    const signer = new AWS.CloudFront.Signer(
      env.CLOUDFRONT_ACCESS_KEY_ID
        ? env.CLOUDFRONT_ACCESS_KEY_ID
        : 'testCloudKey',
      cloudFrontPrivateKey
    );

    const imageUrl = sizeName ? this.image[sizeName] : this.image.original;
    const HTTPS_PATTERN = /^https?:\/\//;
    const url = HTTPS_PATTERN.test(imageUrl)
      ? imageUrl
      : `${env.ASSETS_HOST}/${imageUrl}`;

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
    maxSize: Size
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

  /**
   *
   * @param buffer
   * @param size
   * @param fileType
   * @param options
   * @returns
   */
  static uploadSpecificSizeImage = async (
    buffer: Buffer,
    size: Size,
    fileType: string,
    options?: ImageUploadOptions
  ) => {
    const sharpImage = sharp(buffer);
    const metaData = await sharpImage.metadata();
    size = Image._getNewSameRatioSize(metaData.width, metaData.height, size);
    const newBuffer = await sharpImage
      .resize(size.width, size.height)
      .toFormat(metaData.format, { quality: 70 })
      .toBuffer();
    const uploader = new Uploader(
      env.ASSETS_BUCKET_NAME ? env.ASSETS_BUCKET_NAME : 'testBucketName',
      Configs.IMAGE_BUCKET_FOLDER
    );
    return uploader.uploadBufferToS3(newBuffer, fileType, {
      ...options,
      suffix: size.name,
    });
  };

  static download(
    image: {
      original: string;
      [key: string]: string;
    },
    defaultImage?: string
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

  static async upload(base64: string, options?: ImageUploadOptions) {
    console.debug('original upload()', options);
    const uploader = new Uploader(
      env.ASSETS_BUCKET_NAME ? env.ASSETS_BUCKET_NAME : 'testBucketName',
      Configs.IMAGE_BUCKET_FOLDER
    );
    const contentType = Uploader.getImageContentType(base64);
    const fileType = Uploader.getFileTypeFromBase64(base64);
    const buffer = Uploader.getBufferFromBase64(base64);
    //{ ...options, contentType: contentType }
    //console.debug(`${options.filename}-${OriginalSuffix}`);
    const image: {
      original: string;
      [key: string]: string;
    } = {
      original: await uploader
        .uploadBufferToS3(buffer, fileType, {
          ...options,
          contentType: contentType,
          suffix: OriginalSuffix,
        })
        .then((data) => data.Key),
    };

    //Multisize opton
    if (options.sizes && options.sizes.length > 0) {
      console.debug('options', options);
      for (let i = 0; i < options.sizes.length; i++) {
        image[options.sizes[i].name] = await Image.uploadSpecificSizeImage(
          buffer,
          options.sizes[i],
          fileType,
          {
            ...options,
            contentType: contentType,
          }
        ).then((data) => data.Key);
      }
    }

    return new Image(image, options.order);
  }
}
