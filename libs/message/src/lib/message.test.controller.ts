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
import { Message } from '@castcle-api/message';
import { I18nService } from 'nestjs-i18n';

@Controller('test')
export class MessageTestController {
  private _message: Message;
  constructor(private _i18n: I18nService) {
    this._message = new Message(this._i18n);
  }

  @Get('/common')
  getCommonData(@Query('code') code) {
    return this._message.getCommonMessage(code, 'en', { username: 'Tanasin' });
  }

  @Get('/error')
  getErorData(@Query('code') code) {
    return this._message.getErrorMessage(code, 'en', { username: 'Tanasin' });
  }
}
