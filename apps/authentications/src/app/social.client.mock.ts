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
import { TelegramUserInfo } from '@castcle-api/utils/clients';
export class FacebookClientMock {
  getAccessToken() {
    return {
      access_token: '210058044|uBgVr1NhacSzS7UtJ387yI',
      token_type: 'bearer'
    };
  }

  verifyUserToken(accessToken: string, userToken: string) {
    if (userToken) {
      return {
        app_id: '210058044',
        type: 'USER',
        application: 'Castcle - DEV',
        data_access_expires_at: 1640877720,
        expires_at: 1633107600,
        is_valid: true,
        metadata: {
          auth_type: 'rerequest'
        },
        scopes: ['email', 'public_profile'],
        user_id: userToken
      };
    } else {
      return {
        app_id: '210058044',
        type: 'USER',
        application: 'Castcle - DEV',
        data_access_expires_at: 1640877720,
        expires_at: 1633107600,
        is_valid: false,
        metadata: {
          auth_type: 'rerequest'
        },
        scopes: ['email', 'public_profile'],
        user_id: userToken
      };
    }
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
            width: 50
          }
        },
        email: 'jb@gmail.com',
        name: 'John Block',
        id: userToken
      };
    }
  }
}

export class DownloaderMock {
  getImageFromUrl(url: string) {
    return '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';
  }
}

export class TelegramClientMock {
  verifyUserToken(info: TelegramUserInfo) {
    if (info.hash === '87e5a7e644d0ee362334d92bc8ecc981ca11ffc11eca809505')
      return true;
    else return false;
  }
}

export class TwitterClientMock {
  requestToken() {
    return {
      oauth_token: 'wAAAAABUZusAAABfHLxV60',
      oauth_token_secret: 'FvPJ0hv0AF9ut6RxuAmHJUdpgZPKSEn7',
      results: {
        oauth_callback_confirmed: 'true'
      }
    };
  }

  requestAccessToken(
    accessToken: string,
    tokenSecret: string,
    oauthVerifier: string
  ) {
    return {
      oauth_token: '999999-CPaQRyUqzyGYleMi3f2TUzEbflahkiT',
      oauth_token_secret: 'CWxdy113hukVwJ6HgvBZTF1uXHuQXtLLP5A',
      results: {
        user_id: '999999',
        screen_name: 'john'
      }
    };
  }

  requestVerifyToken(accessToken: string, tokenSecret: string) {
    return {
      id: 999999,
      id_str: '999999',
      name: 'John Wick',
      screen_name: 'john',
      profile_image_url:
        'http://pbs.twimg.com/profile_images/291766490/kzq622-02_normal.jpg',
      profile_image_url_https:
        'https://pbs.twimg.com/profile_images/291766490/kzq622-02_normal.jpg',
      email: 'john@hotmail.com'
    };
  }
}
