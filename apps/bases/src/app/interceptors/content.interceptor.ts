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

import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import {
  SaveContentDto,
  ContentResponse,
  BlogPayload,
  ContentType
} from '@castcle-api/database/dtos';

import { Image } from '@castcle-api/utils/aws';
import {
  CredentialInterceptor,
  CredentialRequest
} from '@castcle-api/utils/interceptors';
import { map } from 'rxjs';

@Injectable()
export class ContentInterceptor extends CredentialInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const superResult = await super.intercept(context, next);
    const req = context.switchToHttp().getRequest() as CredentialRequest;
    const body = req.body as SaveContentDto;
    if (body && body.payload.photo) {
      const contentImages = body.payload.photo.contents.map((url, index) =>
        Image.upload(url.url, {
          filename: `${req.$credential._id}-${body.type}-images-${index}`,
          addTime: true,
          order: index
        })
      );
      const uploadResult = await Promise.all(contentImages);
      const uploadedImages = uploadResult.sort((a, b) => {
        if (a.order > b.order) return -1;
        else return 1;
      });
      body.payload.photo.contents = body.payload.photo.contents.map(
        (url, index) => {
          url.url = uploadedImages[index].uri;
          return url;
        }
      );
      if (
        body.type === ContentType.Blog &&
        (body.payload as BlogPayload).photo.cover
      ) {
        const cover = await Image.upload(
          (body.payload as BlogPayload).photo.cover.url,
          {
            filename: `${req.$credential._id}-${body.type}-cover`,
            addTime: true
          }
        );
        const cover_url = cover.uri;
        (body.payload as BlogPayload).photo.cover.url = cover_url;
      }
    }

    return superResult.pipe(
      map((data: ContentResponse) => {
        console.log('from', data);
        if (
          data.payload.type === ContentType.Blog &&
          (data.payload.payload as BlogPayload).photo &&
          (data.payload.payload as BlogPayload).photo.cover
        ) {
          (data.payload.payload as BlogPayload).photo.cover.url = new Image(
            (data.payload.payload as BlogPayload).photo.cover.url
          ).toSignUrl();
        }
        if (
          data.payload.payload.photo &&
          data.payload.payload.photo.contents &&
          data.payload.payload.photo.contents.length > 0
        ) {
          (data.payload.payload as BlogPayload).photo.contents = (
            data.payload.payload as BlogPayload
          ).photo.contents.map((url) => ({
            url: new Image(url.url).toSignUrl()
          }));
        }
        return data;
      })
    );
  }
}
