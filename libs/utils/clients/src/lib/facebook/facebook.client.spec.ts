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

import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { FacebookClient } from './facebook.client';

export class FacebookClientMock {
  subscribed() {
    return true;
  }

  subscribeApps() {
    return true;
  }

  unsubscribeApps() {
    return true;
  }

  unsubscribed() {
    return true;
  }

  getAccessToken() {
    return {
      access_token: '210058044|uBgVr1NhacSzS7UtJ387yI',
      token_type: 'bearer',
    };
  }

  verifyUserToken(_: string, userToken: string) {
    return {
      app_id: '210058044',
      type: 'USER',
      application: 'Castcle - DEV',
      data_access_expires_at: 1640877720,
      expires_at: 1633107600,
      is_valid: Boolean(userToken),
      metadata: {
        auth_type: 'rerequest',
      },
      scopes: ['email', 'public_profile'],
      user_id: userToken,
    };
  }

  getUserInfo(userToken: string) {
    if (userToken === 'test_empty') {
      return null;
    } else if (userToken === 'exception') {
      throw new String('Error');
    } else {
      return {
        first_name: 'John',
        last_name: 'Block',
        picture: {
          data: {
            height: 50,
            is_silhouette: false,
            url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=109364223&height=50&width=50&ext=1635588772&hash=AeQnpX0QDwSuye2Q-ZA',
            width: 50,
          },
        },
        email: 'jb@gmail.com',
        name: 'John Block',
        id: userToken,
      };
    }
  }
}

describe('FacebookClient', () => {
  let service: FacebookClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FacebookClient],
      imports: [HttpModule],
    }).compile();

    service = module.get<FacebookClient>(FacebookClient);
  });

  it('FacebookClient - should be defined', () => {
    expect(service).toBeDefined();
  });
});
