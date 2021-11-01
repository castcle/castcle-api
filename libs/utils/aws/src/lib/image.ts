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
    if (!env.cloudfront_private_key) return this.image.original;
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
      }/${sizeName ? this.image[sizeName] : this.image.original}`,
      expires: Math.floor((Date.now() + Configs.EXPIRE_TIME) / 1000)
    });
  }

  toSignUrls() {
    const newImage: {
      original: string;
      [key: string]: string;
    } = {
      original: this.toSignUrl()
    };
    Object.keys(this.image).forEach((sizeName) => {
      newImage[sizeName] = this.toSignUrl(sizeName);
    });
    return newImage;
  }

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
    const newBuffer = await sharp(buffer)
      .resize(size.width, size.height)
      .toBuffer();
    const uploader = new Uploader(
      env.assets_bucket_name ? env.assets_bucket_name : 'testBucketName',
      Configs.IMAGE_BUCKET_FOLDER
    );
    return uploader.uploadBufferToS3(newBuffer, fileType, {
      ...options,
      suffix: size.name
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
        original: defaultImage
      };
    } else return undefined;
  }

  static async upload(base64: string, options?: ImageUploadOptions) {
    console.debug('original upload()', options);
    const uploader = new Uploader(
      env.assets_bucket_name ? env.assets_bucket_name : 'testBucketName',
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
          suffix: OriginalSuffix
        })
        .then((data) => data.Key)
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
            contentType: contentType
          }
        ).then((data) => data.Key);
      }
    }

    return new Image(image, options.order);
  }
}
