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

import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GuardTestController } from './guard.test.controller';
import { I18nModule } from 'nestjs-i18n';
import { i18n_options } from '@castcle-api/message';
import {
  AuthenticationToken,
  AuthenticationUserType,
  Token,
  TokenType
} from '@castcle-api/token';

describe('Message', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [I18nModule.forRoot(i18n_options)],
      controllers: [GuardTestController],
      providers: []
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it(`no header`, () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', 'token')
      .expect(401)
      .expect({ statusCode: '401', message: 'Missing Authorization header.' });
  });

  it(`invalid auth token`, () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer 1234`)
      .expect(401)
      .expect({ statusCode: '401', message: 'Access token is expired.' });
  });

  it(`pass`, () => {
    const payload: AuthenticationToken = {
      id: '12345678',
      type: AuthenticationUserType.Guest,
      name: 'Tanasin_Vivitvorn',
      firstName: 'Tanasinn',
      lastName: 'Vivitvorn',
      avatar: '',
      preferredLanguage: 'TH',
      verified: true
    };

    const tokenString = Token.generateToken(payload, TokenType.Access);
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${tokenString}`)
      .expect(200);
  });

  it(`invalid email token`, () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer 1234`)
      .expect(401)
      .expect({ statusCode: '401', message: 'Access token is expired.' });
  });

  it(`pass email`, () => {
    const payload: AuthenticationToken = {
      id: '12345678',
      type: AuthenticationUserType.Guest,
      name: 'Tanasin_Vivitvorn',
      firstName: 'Tanasinn',
      lastName: 'Vivitvorn',
      avatar: '',
      preferredLanguage: 'TH',
      verified: true
    };

    const tokenString = Token.generateToken(payload, TokenType.Access);
    return request(app.getHttpServer())
      .get('/mail')
      .set('Authorization', `Bearer ${tokenString}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
