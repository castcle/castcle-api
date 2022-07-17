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

import { OwnerResponse } from '@castcle-api/database';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as supertest from 'supertest';

export const app = (): NestFastifyApplication => global.__APP__;
export const request = () => supertest(global.__APP__.getHttpServer());
export const registerUser = async (name = Date.now().toString()) => {
  const { body: guest } = await request()
    .post('/v2/authentications/guest')
    .set({
      'Accept-Language': 'en',
      Device: 'CastclePhone',
      Platform: 'CastcleOS',
    })
    .send({
      deviceUUID: `CASTCLE-${name}`,
    })
    .expect(201);

  const { body: user } = await request()
    .post('/v2/authentications/register-with-email')
    .auth(guest.accessToken, { type: 'bearer' })
    .set({
      'Accept-Language': 'en',
      Device: 'CastclePhone',
      Platform: 'CastcleOS',
    })
    .send({
      castcleId: `${name}.castcle`,
      displayName: name,
      email: `${name}@castcle.com`,
      password: 'n+4H&uME63gKv[=',
    })
    .expect(({ body }) => {
      expect(body.message).toBeUndefined();
    })
    .expect(201);

  return user as {
    accessToken: string;
    refreshToken: string;
    profile: OwnerResponse;
    pages: OwnerResponse[];
  };
};
