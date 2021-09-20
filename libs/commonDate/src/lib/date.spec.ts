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

import { CommonDate } from './date';

describe('date', () => {
  it('should work', () => {
    const dt = new CommonDate();
    const date = dt.getDateFromString('19811110', 'YYYY/MM/DD');
    expect(dt.getDateFormat(date, 'DD/MM/YYYY')).toEqual('10/11/1981');
    expect(dt.getDateFormat(dt.addDate(date, 1, 0, 0), 'DD/MM/YYYY')).toEqual(
      '11/11/1981'
    );
    expect(
      dt.getDateFormat(dt.addDate(date, 1, 5, 30), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1981-11-11T05:30:00');
    expect(
      dt.getDateFormat(dt.addMonth(date, 1), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1981-12-10T00:00:00');
    expect(
      dt.getDateFormat(dt.addMonth(date, 2), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1982-01-10T00:00:00');
    expect(
      dt.getDateFormat(dt.addYear(date, 5), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1986-11-10T00:00:00');
  });
});
