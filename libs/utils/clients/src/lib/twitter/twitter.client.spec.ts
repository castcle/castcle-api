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
import { TwitterClient } from './twitter.client';

export class TwitterClientMock {
  requestToken() {
    return {
      oauth_token: 'wAAAAABUZusAAABfHLxV60',
      oauth_token_secret: 'FvPJ0hv0AF9ut6RxuAmHJUdpgZPKSEn7',
      results: {
        oauth_callback_confirmed: 'true',
      },
    };
  }

  requestAccessToken(
    accessToken: string,
    tokenSecret: string,
    oauthVerifier: string,
  ) {
    if (
      accessToken === 'wAAAAABUZusAAABfHLxV60' &&
      tokenSecret === 'FvPJ0hv0AF9ut6RxuAmHJUdpgZPKSEn7' &&
      oauthVerifier === '88888888'
    ) {
      return {
        oauth_token: '999999-CPaQRyUqzyGYleMi3f2TUzEbflahkiT',
        oauth_token_secret: 'CWxdy113hukVwJ6HgvBZTF1uXHuQXtLLP5A',
        results: {
          user_id: '999999',
          screen_name: 'john',
        },
      };
    } else if (accessToken === '77777777') {
      return {
        oauth_token: 'zyGYleMi3f2TUzEbflahkiT',
        oauth_token_secret: 'CukVwJ6HgvBZTF1uXHuQXtLLP5A',
        results: {
          user_id: '9999',
          screen_name: 'johnb',
        },
      };
    } else {
      return null;
    }
  }

  requestVerifyToken(accessToken: string, tokenSecret: string) {
    if (
      accessToken === '999999-CPaQRyUqzyGYleMi3f2TUzEbflahkiT' &&
      tokenSecret === 'CWxdy113hukVwJ6HgvBZTF1uXHuQXtLLP5A'
    ) {
      return {
        id: 999999,
        id_str: '999999',
        name: 'John Wick',
        screen_name: 'john',
        profile_image_url:
          'http://pbs.twimg.com/profile_images/291766490/kzq622-02_normal.jpg',
        profile_image_url_https:
          'https://pbs.twimg.com/profile_images/291766490/kzq622-02_normal.jpg',
        email: 'john@hotmail.com',
      };
    } else {
      return null;
    }
  }
}

describe('TwitterClient', () => {
  let service: TwitterClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TwitterClient],
      imports: [HttpModule],
    }).compile();

    service = module.get<TwitterClient>(TwitterClient);
  });

  it('TwitterClient - should be defined', () => {
    expect(service).toBeDefined();
  });
});
