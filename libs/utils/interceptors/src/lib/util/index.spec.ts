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

import { CastcleException } from '@castcle-api/utils/exception';
import {
  getIpFromRequest,
  getLanguageFromRequest,
  getTokenFromRequest,
} from '.';

describe('#getTokenFromRequest', () => {
  it('should return token from headers as string', () => {
    const headers = { authorization: 'Bearer token' };
    const token = getTokenFromRequest({ headers } as any);

    expect(token).toBe('token');
  });

  it('should throw exception when authorization header have no access token', () => {
    const headers = { authorization: 'Bearer' };

    expect(() => getTokenFromRequest({ headers } as any)).toThrow(
      CastcleException
    );
  });

  it('should throw exception when there is no authorization header', () => {
    expect(() => getTokenFromRequest({ headers: {} } as any)).toThrow(
      CastcleException
    );
  });
});

describe('#getLanguageFromRequest', () => {
  it('should return language from headers as string', () => {
    const headers = { 'accept-language': 'th' };
    const language = getLanguageFromRequest({ headers } as any);

    expect(language).toBe('th');
  });

  it('should throw exception when there is no header', () => {
    expect(() => getLanguageFromRequest({ headers: {} } as any)).toThrow(
      CastcleException
    );
  });
});

describe('#getIpFromRequest', () => {
  it('should return IP from headers as string', () => {
    const headers = {
      'api-metadata': 'ip=127.0.0.1,src=iOS,dest=castcle-authentications',
    };

    const ip = getIpFromRequest({ headers } as any);

    expect(ip).toBe('127.0.0.1');
  });

  it('should throw exception when there is no header', () => {
    expect(() => getIpFromRequest({ headers: {} } as any)).toThrow(
      CastcleException
    );
  });
});
