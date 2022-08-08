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

import { Types } from 'mongoose';
import { createContent, registerUser, request } from '../utils.spec';

export const testContentFarming = async () => {
  describe(`users/:userId/farming/cast/:contentId`, () => {
    it('should throw UNAUTHORIZED when sending request without credential', async () => {
      await request()
        .get('/v2/users/:userId/farming/cast/:contentId')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should throw BAD_REQUEST when userId empty param', async () => {
      const user = await registerUser();

      await request()
        .get(`/v2/users/:userId/farming/cast/${new Types.ObjectId()}`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message.sort()).toEqual(
            ['userId must be a mongodb id'].sort(),
          );
        })
        .expect(400);
    });

    it('should throw BAD_REQUEST when contentId empty param', async () => {
      const user = await registerUser();

      await request()
        .get(`/v2/users/${user.profile.id}/farming/cast/:contentId`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message.sort()).toEqual(
            ['contentId must be a mongodb id'].sort(),
          );
        })
        .expect(400);
    });

    it('should throw FORBIDDEN when wallet does not in the same account', async () => {
      const targetUser = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(targetUser.profile.id);

      await request()
        .get(`/v2/users/${requestedBy.profile.id}/farming/cast/${content.id}`)
        .auth(targetUser.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Can not access the data. Please try again.',
          );
        })
        .expect(403);
    });

    it('should return content farming is correct response', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .get(`/v2/users/${requestedBy.profile.id}/farming/cast/${content.id}`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.id).toEqual(contentFarming.id);
          expect(body.content.id).toEqual(content.id);
          expect(body.authorId).not.toEqual(user.profile.id);
        })
        .expect(200);
    });

    it('should return content farming status equal "farming"', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .get(`/v2/users/${requestedBy.profile.id}/farming/cast/${content.id}`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.id).toEqual(contentFarming.id);
          expect(body.createdAt).toEqual(contentFarming.createdAt);
          expect(body.content.id).toEqual(content.id);
        })
        .expect(200);
    });

    it('should return content farming status not equal "farming" id and createdAt equal null', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .delete(
          `/v2/users/${requestedBy.profile.id}/farming/${contentFarming.id}`,
        )
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({});

      await request()
        .get(`/v2/users/${requestedBy.profile.id}/farming/cast/${content.id}`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.id).toBeNull();
          expect(body.createdAt).toBeNull();
          expect(body.content.id).toEqual(content.id);
        })
        .expect(200);
    });
  });
  describe('farmings/active', () => {
    it('should throw UNAUTHORIZED when sending request without credential', async () => {
      await request()
        .get('/v2/farmings/active')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should return empty when content farming not found', async () => {
      const user = await registerUser();

      await request()
        .get(`/v2/farmings/active`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(0);
        })
        .expect(200);
    });

    it('should return content farming status equal "farming"', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .get(`/v2/farmings/active`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(1);
          expect(body.payload[0].id).toEqual(contentFarming.id);
          expect(body.payload[0].content.id).toEqual(content.id);
        })
        .expect(200);
    });

    it('should return empty content farming status not equal "farming"', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .delete(
          `/v2/users/${requestedBy.profile.id}/farming/${contentFarming.id}`,
        )
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({});

      await request()
        .get(`/v2/farmings/active`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(0);
        })
        .expect(200);
    });
  });

  describe('farmings/history', () => {
    it('should throw UNAUTHORIZED when sending request without credential', async () => {
      await request()
        .get('/v2/farmings/history')
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message).toEqual('Missing Authorization header.');
        })
        .expect(401);
    });

    it('should return empty payload when content farming not found', async () => {
      const user = await registerUser();

      await request()
        .get(`/v2/farmings/history`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(0);
        })
        .expect(200);
    });

    it('should return content farming status equal "farmed"', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      const { body: contentFarming } = await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .delete(
          `/v2/users/${requestedBy.profile.id}/farming/${contentFarming.id}`,
        )
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({});

      await request()
        .get(`/v2/farmings/history`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(1);
          expect(body.payload[0].id).toEqual(contentFarming.id);
          expect(body.payload[0].content.id).toEqual(content.id);
        })
        .expect(200);
    });

    it('should return empty content farming status not equal "farmed"', async () => {
      const user = await registerUser();
      const requestedBy = await registerUser();
      const content = await createContent(user.profile.id);

      await request()
        .post(`/v2/users/${requestedBy.profile.id}/farming/cast`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          targetContentId: content.id,
        });

      await request()
        .get(`/v2/farmings/history`)
        .auth(requestedBy.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.payload).toHaveLength(0);
        })
        .expect(200);
    });
  });
};
