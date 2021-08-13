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
  Param,
  Put,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from '@castcle-api/database';
import { ImageInterceptor } from './interceptors/image.interceptor';
import {
  CredentialInterceptor,
  CredentialRequest
} from '@castcle-api/utils/interceptors';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiResponse
} from '@nestjs/swagger';
import { UpdateUserDto, UserResponseDto } from '@castcle-api/database/dtos';

let logger: CastLogger;

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private userService: UserService
  ) {
    logger = new CastLogger(AppController.name, CastLoggerOptions);
  }

  @Get()
  getData() {
    logger.log('Root');
    return this.appService.getData();
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @ApiBearerAuth()
  @UseInterceptors(ImageInterceptor)
  @Get('me')
  async getMyData(@Req() req: CredentialRequest) {
    //UserService
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) return await user.toUserResponse();
    else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @ApiBearerAuth()
  @UseInterceptors(ImageInterceptor)
  @Get(':id')
  async getUserById(@Req() req: CredentialRequest, @Param('id') id: string) {
    //UserService
    const user = await this.userService.getUserFromId(id);
    if (user) return await user.toUserResponse();
    else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiBody({
    type: UpdateUserDto
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @ApiBearerAuth()
  @UseInterceptors(ImageInterceptor)
  @Put('me')
  async updateMyData(
    @Req() req: CredentialRequest,
    @Body() body: UpdateUserDto
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const afterUpdateUser = await this.userService.updateUser(user, body);
      const response = await afterUpdateUser.toUserResponse();
      return response;
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiResponse({
    status: 204
  })
  @ApiBearerAuth()
  @UseInterceptors(CredentialInterceptor)
  @Delete('me')
  async deleteMyData(@Req() req: CredentialRequest) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      await user.delete();
      return '';
    } else {
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
    }
  }
}
