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

import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { ApiResponse } from '@nestjs/swagger';
import { Me } from '../../dto/me.dto';
import { User } from '../../dto/user.dto';

@Controller('me')
export class MeController {
  private readonly logger = new CastLogger(
    MeController.name,
    CastLoggerOptions
  );

  @Get()
  @ApiResponse({
    status: 201,
    description: 'The record has been successfully created.'
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getData(@Body() user: User) {
    this.logger.log('me');

    return '';
  }

  @Put()
  putData(@Body() me: Me) {
    this.logger.log('me');

    return '';
  }

  @Delete()
  deleteData(@Body() id: String) {
    this.logger.log('me');

    return '';
  }
}
