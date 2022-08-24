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

export const testGuestLogin = () =>
  describe('POST: authentications/guest', () => {
    it('should throw BAD_REQUEST when deviceUUID is missing', async () => {
      await request()
        .post('/v2/authentications/guest')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message.sort()).toEqual([
            'deviceUUID must be a string',
            'deviceUUID should not be empty',
          ]);
        })
        .expect(400);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if device header is missing', async () => {
      await request()
        .post('/v2/authentications/guest')
        .set({
          'Accept-Language': 'en',
          Platform: 'CastcleOS',
        })
        .send({
          deviceUUID: Date.now().toString(),
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw MISSING_AUTHORIZATION_HEADERS if platform header is missing', async () => {
      await request()
        .post('/v2/authentications/guest')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
        })
        .send({
          deviceUUID: Date.now().toString(),
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw access token and refresh token', async () => {
      await request()
        .post('/v2/authentications/guest')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          deviceUUID: Date.now().toString(),
        })
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
          expect(body.accessToken).toBeDefined();
          expect(body.refreshToken).toBeDefined();
        })
        .expect(201);
    });
  });
