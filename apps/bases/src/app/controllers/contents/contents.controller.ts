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
import {
  AuthenticationService,
  UserService,
  ContentService
} from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import {
  ContentPayloadDto,
  CreateContentDto
} from '@castcle-api/database/dtos';
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
  ApiOkResponse,
  ApiProperty,
  ApiResponse
} from '@nestjs/swagger';

class ContentResponse {
  @ApiProperty()
  payload: ContentPayloadDto;
}

@Controller()
export class ContentController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService
  ) {}
  private readonly logger = new CastLogger(
    ContentController.name,
    CastLoggerOptions
  );

  @ApiBearerAuth()
  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiBody({
    type: CreateContentDto
  })
  @ApiResponse({
    status: 201,
    type: ContentResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('contents/feed')
  async createFeedContent(
    @Body() body: CreateContentDto,
    @Req() req: CredentialRequest
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    const content = await this.contentService.createContentFromUser(user, body);
    return {
      payload: content.toPagePayload()
    } as ContentResponse;
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiOkResponse({
    type: ContentResponse
  })
  @Get('contents/:id')
  async getContentFromId(@Param('id') id: string) {
    const content = await this.contentService.getContentFromId(id);
    return {
      payload: content.toPagePayload()
    } as ContentResponse;
  }
}
