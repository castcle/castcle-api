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

import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
const defaultOffset = '+07:00';
const defaultFormat = 'yyyy-MM-DDThh:mm:ss';

@Injectable()
export class CommonDate {
  getDate(offset: string): Date {
    if (!offset) {
      offset = defaultOffset;
    }
    return new Date(moment().utcOffset(offset).format());
  }

  getDateFormat(date: Date, format: string): string {
    if (!date) {
      date = new Date();
    }

    if (!format) {
      format = defaultFormat;
    }

    return moment(date).format(format);
  }

  getDateFromString(str: string, format: string): Date {
    if (!format) {
      format = defaultFormat;
    }

    return new Date(moment(str).format(format));
  }

  addDate(dt: Date, day: number, hour: number, min: number): Date {
    if (!dt) {
      dt = new Date();
    }
    const minuteAdd = day * 1440 + hour * 60 + min;
    return new Date(dt.getTime() + 60000 * minuteAdd);
  }

  addMonth(dt: Date, mon: number) {
    if (!dt) {
      dt = new Date();
    }

    return new Date(moment(dt).add(mon, 'months').calendar());
  }

  addYear(dt: Date, year: number) {
    if (!dt) {
      dt = new Date();
    }

    return new Date(moment(dt).add(year, 'years').calendar());
  }
}
