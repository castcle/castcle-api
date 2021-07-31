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

import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { ApiResponse, ApiOkResponse } from '@nestjs/swagger';
import { dto } from '@castcle-api/database';

@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({
    type: dto.users.User
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getData() {
    return {
      id: 'uid',
      castcleId: 'castcle',
      displayName: 'Display Name',
      email: 'caXXXXle@castcle.com',
      overview: "What's make you different?",
      dob: 'yyyy-MM-dd',
      images: {
        avatar: 'url',
        cover: 'url'
      },
      links: {
        facebook: 'https://facebook.com',
        twitter: 'https://twitter.com',
        youtube: 'https://youtube.com',
        medium: 'https://medium.com',
        website: null
      },
      following: {
        count: 1234
      },
      followers: {
        count: 1234
      },
      verified: true,
      followed: true
    };
  }

  @ApiOkResponse({
    type: dto.users.User
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @Put()
  putData(@Body() me: dto.users.Me) {
    return {
      id: 'uid',
      castcleId: 'castcle',
      displayName: 'Display Name',
      email: 'caXXXXle@castcle.com',
      overview: me.overview,
      dob: me.dob,
      images: {
        avatar: me.images.avatar,
        cover: me.images.cover
      },
      links: {
        facebook: me.links.facebook,
        twitter: me.links.twitter,
        youtube: me.links.youtube,
        medium: me.links.medium,
        website: null
      },
      following: {
        count: 0
      },
      followers: {
        count: 0
      },
      verified: true,
      followed: true
    };
  }

  @ApiResponse({
    status: 204,
    description: 'success'
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @Delete()
  @HttpCode(204)
  deleteData() {
    return;
  }
}
