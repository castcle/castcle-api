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
  FollowResponse,
  UpdateUserDto,
  UserResponseDto
} from '@castcle-api/database/dtos';
import { Response } from 'express';
import { Image } from '@castcle-api/utils/aws';
import {
  CredentialInterceptor,
  CredentialRequest
} from '@castcle-api/utils/interceptors';
import { map } from 'rxjs';

@Injectable()
export class ImageInterceptor extends CredentialInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const superResult = await super.intercept(context, next);
    const req = context.switchToHttp().getRequest() as CredentialRequest;
    const body = req.body as UpdateUserDto;
    if (body.images && body.images.avatar) {
      const avatar = await Image.upload(body.images.avatar, {
        filename: `avatar-${req.$credential.account._id}`
      });
      req.body.images.avatar = avatar.uri;
    }
    if (body.images && body.images.cover) {
      const cover = await Image.upload(body.images.cover, {
        filename: `cover-${req.$credential.account._id}`
      });
      req.body.images.cover = cover.uri;
    }

    return superResult.pipe(
      map((data: UserResponseDto) => {
        console.log('from', data);
        if (data.images && data.images.avatar)
          data.images.avatar = new Image(data.images.avatar).toSignUrl();
        if (data.images && data.images.cover)
          data.images.cover = new Image(data.images.cover).toSignUrl();
        return data;
      })
    );
  }
}

@Injectable()
export class FollowInterceptor extends CredentialInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const superResult = await super.intercept(context, next);
    const res = context.switchToHttp().getResponse() as Response;
    res.setHeader('Content-Disposition', 'inline');
    return superResult.pipe(
      map((data: FollowResponse) => {
        data.payload = data.payload.map((response) => {
          if (response.images && response.images.avatar)
            response.images.avatar = new Image(
              response.images.avatar
            ).toSignUrl();
          if (response.images && response.images.cover)
            response.images.cover = new Image(
              response.images.cover
            ).toSignUrl();
          return response;
        });
        return data;
      })
    );
  }
}
