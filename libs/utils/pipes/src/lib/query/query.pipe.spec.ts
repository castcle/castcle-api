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

import { DEFAULT_QUERY_OPTIONS } from '@castcle-api/database';
import { LIMIT_MAX, LimitPipe, PagePipe, SortByPipe } from './query.pipe';

describe('SortByPipe', () => {
  let pipe: SortByPipe;
  beforeAll(() => {
    pipe = new SortByPipe();
  });
  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });
  it('should detect if sortBy is either desc(field) or asc(field)', () => {
    const descResult = pipe.transform('desc(test)');
    expect(descResult.type).toEqual('desc');
    expect(descResult.field).toEqual('test');
    const ascResult = pipe.transform('asc(test)');
    expect(ascResult.type).toEqual('asc');
    expect(ascResult.field).toEqual('test');
  });
});

describe('LimitPipe', () => {
  let pipe: LimitPipe;
  beforeAll(() => {
    pipe = new LimitPipe();
  });
  it('should convert limitQuery to number', () => {
    expect(pipe.transform('5')).toEqual(5);
  });
  it(`should return ${LIMIT_MAX} if limitQuery is exceed the limit`, () => {
    expect(pipe.transform(`${LIMIT_MAX + 50}`)).toEqual(LIMIT_MAX);
  });
  it(`should return default (${DEFAULT_QUERY_OPTIONS.limit}) when limitQuery is not a number`, () => {
    expect(pipe.transform('abc')).toEqual(DEFAULT_QUERY_OPTIONS.limit);
  });
});

describe('PagePipe', () => {
  let pipe: PagePipe;
  beforeAll(() => {
    pipe = new PagePipe();
  });
  it('should convert pageQuery to number', () => {
    expect(pipe.transform('5')).toEqual(5);
  });
  it(`should return default (${DEFAULT_QUERY_OPTIONS.page}) when pageQuery is not a number`, () => {
    expect(pipe.transform('abc')).toEqual(DEFAULT_QUERY_OPTIONS.page);
  });
});
