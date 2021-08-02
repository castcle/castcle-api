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

import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponse, ApiOkResponse, refs } from '@nestjs/swagger';
import { dto } from '@castcle-api/database';

@Controller('contents')
export class ContentsController {
  @ApiOkResponse({
    schema: {
      anyOf: refs(dto.content.ContentsDto)
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @Get()
  getContents(@Query() query) {
    return {
      message: 'success message',
      payload: [
        {
          id: '{UUID}',
          type: 'short',
          payload: {
            content: 'content',
            photo: {
              contents: [{ url: 'url' }]
            },
            link: [
              {
                type: 'youtube',
                url: 'url'
              }
            ]
          },
          feature: {
            id: '{UUID}',
            slug: 'feed',
            name: 'Feed',
            key: 'feature.feed'
          },
          liked: {
            count: 1234,
            liked: true,
            participant: [
              {
                type: 'people',
                id: '{UUID}',
                name: 'display name'
              }
            ]
          },
          commented: {
            count: 1234,
            commented: true,
            participant: [
              {
                type: 'people', // people or page
                id: '{UUID}',
                name: 'display name'
              }
            ]
          },
          recasted: {
            count: 1234,
            recasted: true,
            participant: [
              {
                type: 'people',
                id: '{UUID}',
                name: 'display name'
              }
            ]
          },
          quoteCast: 'content',
          author: {
            id: '{UUID}',
            type: 'people',
            displayName: 'display name',
            avatar: '{url-image}',
            verified: true,
            followed: true
          },
          created: '2021-06-05T15:40:29Z',
          updated: '2021-06-05T15:40:29Z'
        }
      ],
      pagination: {
        previous: 1,
        self: 2,
        next: 3,
        limit: 25
      }
    };
  }
}
