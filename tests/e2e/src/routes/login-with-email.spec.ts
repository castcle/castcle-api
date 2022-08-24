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

import { request } from '../utils.spec';

export const testLoginWithEmail = () =>
  describe('POST: authentications/login-with-email', () => {
    it('should throw BAD_REQUEST when email or password is missing', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .auth('<bearer-token>', { type: 'bearer' })
        .send({})
        .expect(({ body }) => {
          expect(body.message).toBeInstanceOf(Array);
          expect(body.message.sort()).toEqual([
            'email must be an email',
            'password must be a string',
            'password should not be empty',
          ]);
        })
        .expect(400);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if device header is missing', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          'Accept-Language': 'en',
          Platform: 'CastcleOS',
        })
        .send({
          email: 'test@castcle.com',
          password: '1234!@#$asdfASDF',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if language header is missing', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          email: 'test@castcle.com',
          password: '1234!@#$asdfASDF',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if platform header is missing', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
        })
        .send({
          email: 'test@castcle.com',
          password: '1234!@#$asdfASDF',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if token header is missing', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          email: 'test@castcle.com',
          password: '1234!@#$asdfASDF',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw INVALID_ACCESS_TOKEN if guest token does not exist', async () => {
      await request()
        .post('/v2/authentications/login-with-email')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .auth('<invalid-bearer-token>', { type: 'bearer' })
        .send({
          email: 'test@castcle.com',
          password: '1234!@#$asdfASDF',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Invalid access token or expire');
        })
        .expect(401);
    });
  });
