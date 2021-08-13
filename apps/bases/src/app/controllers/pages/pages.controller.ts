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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { AppService } from '../../app.service';
import { AuthenticationService, UserService } from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { PageDto, UpdatePageDto } from '@castcle-api/database/dtos';
import {
  CredentialInterceptor,
  CredentialRequest
} from '@castcle-api/utils/interceptors';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { Image } from '@castcle-api/utils/aws';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiResponse
} from '@nestjs/swagger';

@Controller()
export class PageController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService
  ) {}
  private readonly logger = new CastLogger(
    PageController.name,
    CastLoggerOptions
  );

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiBearerAuth()
  @ApiBody({
    type: PageDto
  })
  @ApiResponse({
    status: 201,
    type: PageDto
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('pages')
  async createPage(@Req() req: CredentialRequest, @Body() body: PageDto) {
    //check if page name exist
    const namingResult = await this.authService.getUserFromCastcleId(
      body.username
    );
    if (namingResult)
      throw new CastcleException(CastcleStatus.PAGE_IS_EXIST, req.$language);
    //TODO !!! performance issue
    body.avatar = (
      await Image.upload(body.avatar, {
        filename: `page-avatar-${body.username}`
      })
    ).uri;
    body.cover = (
      await Image.upload(body.cover, {
        filename: `page-cover-${body.username}`
      })
    ).uri;
    const page = await this.userService.createPageFromCredential(
      req.$credential,
      body
    );
    return page.toPageResponse();
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiBearerAuth()
  @ApiBody({
    type: UpdatePageDto
  })
  @ApiResponse({
    status: 201,
    type: PageDto
  })
  @HttpCode(201)
  @UseInterceptors(CredentialInterceptor)
  @Put('pages/:id')
  async updatePage(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Body() body: UpdatePageDto
  ) {
    //check if page name exist
    const page = await this.userService.getUserFromId(id);
    console.log(id, page);
    if (!page)
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
    //TODO !!! performance issue
    if (body.avatar)
      page.profile.images.avatar = (
        await Image.upload(body.avatar, {
          filename: `page-avatar-${id}`
        })
      ).uri;
    if (body.cover)
      page.profile.images.cover = (
        await Image.upload(body.cover, {
          filename: `page-cover-${id}`
        })
      ).uri;
    if (body.displayName) page.displayName = body.displayName;
    const afterPage = await page.save();
    return afterPage.toPageResponse();
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 204
  })
  @HttpCode(204)
  @Delete('pages/:id')
  async deletePage(@Req() req: CredentialRequest, @Param('id') id: string) {
    const page = await this.userService.getUserFromId(id);
    if (!page)
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );

    if (String(page.ownerAccount) === String(req.$credential.account._id)) {
      await page.delete();
      return '';
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }
}
