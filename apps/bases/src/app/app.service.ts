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

import { PageDto, PageModelDto } from '@castcle-api/database/dtos';
import { Configs } from '@castcle-api/environments';
import {
  Image,
  COMMON_SIZE_CONFIGS,
  AVARTAR_SIZE_CONFIGS
} from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to bases!' };
  }

  /**
   *
   * @param body
   * @returns
   */
  async uploadPage(body: PageDto): Promise<PageModelDto> {
    const pageModelDto: PageModelDto = {
      ...body,
      avatar: {
        original: Configs.DefaultAvatar
      },
      cover: {
        original: Configs.DefaultCover
      }
    };
    if (body.avatar) {
      const avatar = await Image.upload(body.avatar as string, {
        filename: `page-avatar-${body.castcleId}`,
        addTime: true,
        sizes: AVARTAR_SIZE_CONFIGS,
        subpath: `page_${body.castcleId}`
      });
      pageModelDto.avatar = avatar.image;
    }
    if (body.cover) {
      const cover = await Image.upload(body.avatar as string, {
        filename: `page-cover-${body.castcleId}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `page_${body.castcleId}`
      });
      pageModelDto.avatar = cover.image;
    }
    return pageModelDto;
  }
}
