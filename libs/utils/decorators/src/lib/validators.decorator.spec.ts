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

import { IsString, validateSync } from 'class-validator';
import { RequireAtLeastOne } from './validators.decorator';

describe('Validators', () => {
  class Target {
    @RequireAtLeastOne('field1', 'field2')
    @IsString()
    field1?: string;

    @RequireAtLeastOne('field1', 'field2')
    @IsString()
    field2?: string;

    constructor(target: Target) {
      this.field1 = target.field1;
      this.field2 = target.field2;
    }
  }

  it('should return validation failed on field 1 and 2 if nothing filled', async () => {
    const object = new Target({});
    const errors = validateSync(object);

    expect(errors.length).toEqual(2);
    expect(errors[0].constraints.isString).toEqual('field1 must be a string');
    expect(errors[1].constraints.isString).toEqual('field2 must be a string');
  });

  it('should validate field 1 and 2 if field 1 and 2 filled', () => {
    const object = new Target({ field1: 1, field2: 2 } as any);
    const errors = validateSync(object);

    expect(errors.length).toEqual(2);
    expect(errors[0].constraints.isString).toEqual('field1 must be a string');
    expect(errors[1].constraints.isString).toEqual('field2 must be a string');
  });

  it('should validate field 1 if only field 1 filled', () => {
    const object = new Target({ field1: 1 } as any);
    const errors = validateSync(object);

    expect(errors.length).toEqual(1);
    expect(errors[0].constraints.isString).toEqual('field1 must be a string');
  });

  it(`should validate field 2 if only field 2 filled`, () => {
    const object = new Target({ field2: 2 } as any);
    const errors = validateSync(object);

    expect(errors.length).toEqual(1);
    expect(errors[0].constraints.isString).toEqual('field2 must be a string');
  });
});
