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

import { Environment } from '@castcle-api/environments';

export class CastcleNumber {
  public n: number;
  public f: number;

  constructor(n: number | string, f: number | string) {
    const maxFloatingPoint = Number(
      '1'.padEnd(Environment.DECIMALS_FLOAT + 1, '0')
    );
    this.n = Number(n || 0);
    this.f = Number(f || 0);

    if (this.f >= maxFloatingPoint) {
      this.n = this.n + Math.ceil(this.f / maxFloatingPoint);
      this.f = this.f % maxFloatingPoint;
    }
  }

  static from(str: number | string) {
    const [n, f] = (typeof str === 'string' ? Number(str) : str)
      .toFixed(Environment.DECIMALS_FLOAT)
      .split('.');

    return new CastcleNumber(
      Number(n || ''),
      Number(
        (f || '')
          .slice(0, Environment.DECIMALS_FLOAT)
          .padEnd(Environment.DECIMALS_FLOAT, '0')
      )
    );
  }

  static subtract(num1: number | string, num2: number | string) {
    const n1 = CastcleNumber.from(num1);
    const n2 = CastcleNumber.from(num2);

    if (n1.f - n2.f >= 0) {
      return new CastcleNumber(n1.n - n2.n, n1.f - n2.f);
    }

    const additional = Number('1'.padEnd(Environment.DECIMALS_FLOAT + 1, '0'));

    return new CastcleNumber(n1.n - n2.n - 1, additional + n1.f - n2.f);
  }

  toString() {
    const n = String(this.n).padStart(Environment.DECIMALS_INT, '0');
    const f = String(this.f).padStart(Environment.DECIMALS_FLOAT, '0');

    return `${n}.${f}`;
  }

  toNumber() {
    return Number(this.toString());
  }
}
