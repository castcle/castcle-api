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
import { GoogleClient } from './google.client';

export class GoogleClientMock {
  async verifyToken(token: string) {
    if (token === '1') {
      return null;
    } else {
      return {
        aud: 'com.sarunw.google',
        user_id: 'mock_user_google',
        scopes: ['name', 'email'],
        expiry_date: 1577943013,
        sub: '111.222.333',
        azp: '',
        access_type: '',
        email: 'test@gmail.com',
        email_verified: true,
      };
    }
  }

  async getGoogleUserInfo(token: string) {
    let result;
    if (token === '1' || token === '3') {
      result = null;
    } else if (token === '2') {
      result = {
        email: 'test@gmail.com',
        id: 'mock_user_google_2',
        name: 'John Dow',
      };
    } else {
      result = {
        email: 'test@gmail.com',
        id: 'mock_user_google',
        name: 'John Dow',
      };
    }

    return result;
  }
}

describe('GoogleClient', () => {
  let service: GoogleClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleClient],
      imports: [HttpModule],
    }).compile();

    service = module.get<GoogleClient>(GoogleClient);
  });

  it('GoogleClient - should be defined', () => {
    expect(service).toBeDefined();
  });
});
