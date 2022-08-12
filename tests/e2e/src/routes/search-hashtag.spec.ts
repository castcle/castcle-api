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
import { getModelToken } from '@nestjs/mongoose';
import { app, registerUser, request } from '../utils.spec';

export const testSearchHashtag = () => {
  describe('GET v2/searches/hashtags', () => {
    it('should get nothing because there is no Hashtag in db', async () => {
      const user = await registerUser();
      await request()
        .get('/v2/searches/hashtags')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toEqual([]);
        });
    });
    it('should found 1 hashtag that related to query', async () => {
      const user = await registerUser();
      await app()
        .get(getModelToken('Hashtag'))
        .create({
          tag: 'testdo',
          name: 'testdo',
          score: 20,
          aggregator: {
            name: 'default',
          },
        });
      await app()
        .get(getModelToken('Hashtag'))
        .create({
          tag: 'testno',
          name: 'testno',
          score: 1,
          aggregator: {
            name: 'default',
          },
        });
      await request()
        .get('/v2/searches/hashtags')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload[0]).toEqual(
            expect.objectContaining({
              name: 'testdo',
              rank: 1,
              slug: 'testdo',
            }),
          );
          expect(body.payload[1]).toEqual(
            expect.objectContaining({
              name: 'testno',
              rank: 2,
              slug: 'testno',
            }),
          );
        });
    });
  });
};
