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

import { DateTime, DateTimeUnit } from 'luxon';
export class CastcleDate {
  /**
   * Convert a timezone string to a UTC offset.
   * @param {string} timeZone - The time zone to convert to.
   * @returns
   */
  static convertTimezone(timeZone: string) {
    return `UTC${timeZone}`;
  }

  /**
   * Convert the date filter interval to a start and end date time
   * @param {string} timeZone - The timezone of the date interval.
   * @param {FilterInterval} dateInterval enum of filter
   * @returns
   */

  static convertDateFilterInterval(
    timeZone: string,
    dateInterval: DateTimeUnit | 'today',
  ) {
    const now = new Date();
    const interval = dateInterval === 'today' ? 'day' : dateInterval;
    return {
      startDate: DateTime.fromJSDate(now, {
        zone: this.convertTimezone(timeZone),
      })
        .startOf(interval)
        .toJSDate(),
      endDate: DateTime.fromJSDate(now, {
        zone: this.convertTimezone(timeZone),
      })
        .endOf(interval)
        .toJSDate(),
    };
  }

  static checkIntervalNotify = (dateBefore: Date, unitTime: number) => {
    if (!dateBefore || unitTime === 0) return true;
    return (
      new Date().getTime() >
      new Date(
        DateTime.fromJSDate(dateBefore).plus({ hours: unitTime }).toISO(),
      ).getTime()
    );
  };
}
