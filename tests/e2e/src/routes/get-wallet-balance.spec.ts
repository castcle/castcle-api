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

import {
  Transaction,
  TransactionStatus,
  WalletType,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { app, registerUser, request } from '../utils.spec';

export const testGetWalletBalance = () =>
  describe('GET: wallets/:userId', () => {
    it('should throw UNAUTHORIZED when sending request without credential', async () => {
      await request()
        .get('/v2/wallets/me')
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

    it('should throw FORBIDDEN when wallet does not in the same account', async () => {
      const user = await registerUser();
      const receiver = await registerUser();

      await request()
        .get(`/v2/wallets/${receiver.profile.id}`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Can not access the data. Please try again.',
          );
        })
        .expect(403);
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user does not exits', async () => {
      const user = await registerUser();

      await request()
        .get('/v2/wallets/unknown-user-id')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Username or the page could not be found. Please try again.',
          );
        })
        .expect(404);
    });

    it('should return zero balance when user does not has any transaction', async () => {
      const user = await registerUser();

      await request()
        .get('/v2/wallets/me')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .expect(({ body }) => {
          expect(body).toEqual({
            id: user.profile.id,
            displayName: user.profile.displayName,
            castcleId: user.profile.castcleId,
            availableBalance: '0.00000000',
            adsCredit: '0.00000000',
            farmBalance: '0.00000000',
            totalBalance: '0.00000000',
          });
        })
        .expect(200);
    });

    it(`should return user balance in string format with ${Environment.DECIMALS_FLOAT} decimals points`, async () => {
      const user = await registerUser();

      await app()
        .get<Model<Transaction>>(getModelToken('Transaction'))
        .create([
          {
            from: { type: WalletType.CASTCLE_AIRDROP, value: 1_000 },
            to: [
              {
                user: new Types.ObjectId(user.profile.id),
                type: WalletType.ADS,
                value: 1_000,
              },
            ],
            status: TransactionStatus.VERIFIED,
          },
          {
            from: { type: WalletType.CASTCLE_AIRDROP, value: 1_000 },
            to: [
              {
                user: new Types.ObjectId(user.profile.id),
                type: WalletType.FARM_LOCKED,
                value: 1_000,
              },
            ],
            status: TransactionStatus.VERIFIED,
          },
          {
            from: { type: WalletType.CASTCLE_AIRDROP, value: 2_000 },
            to: [
              {
                user: new Types.ObjectId(user.profile.id),
                type: WalletType.PERSONAL,
                value: 2_000,
              },
            ],
            status: TransactionStatus.VERIFIED,
          },
          {
            from: {
              user: new Types.ObjectId(user.profile.id),
              type: WalletType.PERSONAL,
              value: 1_000,
            },
            to: [{ type: WalletType.EXTERNAL_WITHDRAW, value: 1_000 }],
            status: TransactionStatus.PENDING,
          },
        ]);

      await request()
        .get('/v2/wallets/me')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .expect(({ body }) => {
          expect(body).toEqual({
            id: user.profile.id,
            displayName: user.profile.displayName,
            castcleId: user.profile.castcleId,
            availableBalance: '2000.00000000',
            adsCredit: '1000.00000000',
            farmBalance: '1000.00000000',
            totalBalance: '4000.00000000',
          });
        })
        .expect(200);
    });
  });
