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
import { UpdateUserDto, UpdateModelUserDto } from '@castcle-api/database/dtos';
import {
  Image,
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS
} from '@castcle-api/utils/aws';
import { CredentialRequest } from '@castcle-api/utils/interceptors';

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to users!' };
  }

  /**
   * Upload any image in s3 and transform UpdateUserDto to UpdateModelUserDto
   * @param {UpdateUserDto} body
   * @param {CredentialRequest} req
   * @returns {UpdateModelUserDto}
   */
  async uploadUserInfo(
    body: UpdateUserDto,
    req: CredentialRequest
  ): Promise<UpdateModelUserDto> {
    let updateModelUserDto: UpdateModelUserDto = {};
    console.debug('uploading info', `avatar-${req.$credential.account._id}`);
    console.debug(body);
    updateModelUserDto.images = {};
    if (body.images && body.images.avatar) {
      const avatar = await Image.upload(body.images.avatar as string, {
        filename: `avatar-${req.$credential.account._id}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `account_${req.$credential.account._id}`
      });
      updateModelUserDto.images.avatar = avatar.image;
      console.debug('after update', updateModelUserDto);
    }
    if (body.images && body.images.cover) {
      const cover = await Image.upload(body.images.cover as string, {
        filename: `cover-${req.$credential.account._id}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `account_${req.$credential.account._id}`
      });
      updateModelUserDto.images.cover = cover.image;
    }
    updateModelUserDto = { ...body, images: updateModelUserDto.images };
    return updateModelUserDto;
  }
}
