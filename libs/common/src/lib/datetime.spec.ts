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

import { CastcleDate } from './datetime';

describe('#CastcleDate', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2022-03-02T17:00:00.000Z'));
  });

  it('should able to convert current date startOf - endOf today.', () => {
    const { startDate, endDate } = CastcleDate.convertDateFilterInterval(
      '+07:00',
      'today',
    );

    expect(startDate.toISOString()).toBe('2022-03-02T17:00:00.000Z');
    expect(endDate.toISOString()).toBe('2022-03-03T16:59:59.999Z');
  });

  it('should able convert current date startOf - endOf week.', () => {
    const { startDate, endDate } = CastcleDate.convertDateFilterInterval(
      '+07:00',
      'week',
    );

    expect(startDate.toISOString()).toBe('2022-02-27T17:00:00.000Z');
    expect(endDate.toISOString()).toBe('2022-03-06T16:59:59.999Z');
  });

  it('should able convert current date startOf - endOf month.', () => {
    const { startDate, endDate } = CastcleDate.convertDateFilterInterval(
      '+07:00',
      'month',
    );

    expect(startDate.toISOString()).toBe('2022-02-28T17:00:00.000Z');
    expect(endDate.toISOString()).toBe('2022-03-31T16:59:59.999Z');
  });
});
