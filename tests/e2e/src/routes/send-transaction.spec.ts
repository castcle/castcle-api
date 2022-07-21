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
  EntityVisibility,
  NetworkType,
  OtpObjective,
  TAccountService,
  WalletType,
} from '@castcle-api/database';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { getModelToken } from '@nestjs/mongoose';
import { app, registerUser, request } from '../utils.spec';

export const testSendTransaction = () =>
  describe('wallets/:userId/send/confirm', () => {
    it('should throw UNAUTHORIZED when sending request without credential', async () => {
      await request()
        .post('/v2/wallets/me/send/confirm')
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

    it('should throw BAD_REQUEST when sending empty body', async () => {
      const user = await registerUser();

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({})
        .expect(({ body }) => {
          expect(body.message.sort()).toEqual(
            [
              'transaction must be a non-empty object',
              'verification must be a non-empty object',
            ].sort(),
          );
        })
        .expect(400);
    });

    it('should throw BAD_REQUEST when sending invalid body', async () => {
      const user = await registerUser();

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({ transaction: {}, verification: { email: {}, mobile: {} } })
        .expect(({ body }) => {
          expect(body.message.sort()).toEqual(
            [
              'transaction.chainId should not be empty',
              'transaction.chainId must be a string',
              'transaction.address should not be empty',
              'transaction.address must be a string',
              'transaction.amount must be a positive number',
              'transaction.amount must be a number conforming to the specified constraints',
              'verification.email must be a non-empty object',
              'verification.email.email must be an email',
              'verification.email.otp must be a string',
              'verification.email.otp should not be empty',
              'verification.email.refCode must be a string',
              'verification.email.refCode should not be empty',
              'verification.mobile must be a non-empty object',
              'verification.mobile.countryCode must be a string',
              'verification.mobile.countryCode should not be empty',
              'verification.mobile.mobileNumber must be a phone number',
              'verification.mobile.otp must be a string',
              'verification.mobile.otp should not be empty',
              'verification.mobile.refCode must be a string',
              'verification.mobile.refCode should not be empty',
            ].sort(),
          );
        })
        .expect(400);
    });

    it('should throw FORBIDDEN when wallet does not in the same account', async () => {
      const user = await registerUser();
      const receiver = await registerUser();

      await request()
        .post(`/v2/wallets/${receiver.profile.id}/send/confirm`)
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: user.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Can not access the data. Please try again.',
          );
        })
        .expect(403);
    });

    it('should throw NETWORK_NOT_FOUND when network does not exits', async () => {
      const user = await registerUser();

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: user.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual('Network not found');
        })
        .expect(404);
    });

    it('should throw NETWORK_TEMPORARILY_DISABLED when network status !== publish', async () => {
      const user = await registerUser();

      await app().get(getModelToken('Network')).create({
        name: 'Castcle Wallet',
        type: NetworkType.INTERNAL,
        rpc: 'internal',
        chainId: 'internal',
        visibility: EntityVisibility.Hidden,
      });

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: user.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Network has been temporarily disabled.',
          );
        })
        .expect(400);
    });

    it('should throw NOT_ENOUGH_BALANCE when balance is less than requested amount', async () => {
      const user = await registerUser();

      await app().get(getModelToken('Network')).create({
        name: 'Castcle Wallet',
        type: NetworkType.INTERNAL,
        rpc: 'internal',
        chainId: 'internal',
        visibility: EntityVisibility.Publish,
      });

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: user.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Wallet does not have sufficient balance.',
          );
        })
        .expect(400);
    });

    it('should return PAYMENT_TO_OWN_WALLET when sending transaction to own wallet', async () => {
      const user = await registerUser();

      await Promise.all([
        app().get(getModelToken('Network')).create({
          name: 'Castcle Wallet',
          type: NetworkType.INTERNAL,
          rpc: 'internal',
          chainId: 'internal',
          visibility: EntityVisibility.Publish,
        }),
        app().get(TAccountService).topUp({
          type: WalletType.PERSONAL,
          value: 1,
          userId: user.profile.id,
        }),
      ]);

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: user.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Payment to your own wallet is not supported.',
          );
        })
        .expect(400);
    });

    it('should return INVALID_OTP when OTP or ref code is invalid', async () => {
      const user = await registerUser();
      const receiver = await registerUser();

      await Promise.all([
        app().get(getModelToken('Network')).create({
          name: 'Castcle Wallet',
          type: NetworkType.INTERNAL,
          rpc: 'internal',
          chainId: 'internal',
          visibility: EntityVisibility.Publish,
        }),
        app().get(TAccountService).topUp({
          type: WalletType.PERSONAL,
          value: 1,
          userId: user.profile.id,
        }),
      ]);

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: receiver.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toEqual(
            'Invalid email OTP code. Please try again.',
          );
        })
        .expect(400);
    });

    it('should return NO_CONTENT when internal transaction has been reviewed successfully', async () => {
      const user = await registerUser();
      const receiver = await registerUser();

      await Promise.all([
        app()
          .get(getModelToken('Otp'))
          .create([
            {
              refCode: '123456',
              retry: 0,
              sentAt: [new Date()],
              action: OtpObjective.SEND_TOKEN,
              channel: TwilioChannel.EMAIL,
              receiver: user.profile.email,
              account: user.profile.id,
              expireDate: new Date('3000'),
            },
            {
              refCode: '123456',
              retry: 0,
              sentAt: [new Date()],
              action: OtpObjective.SEND_TOKEN,
              channel: TwilioChannel.SMS,
              receiver: '+66812341234',
              account: user.profile.id,
              expireDate: new Date('3000'),
            },
          ]),
        app().get(getModelToken('Network')).create({
          name: 'Castcle Wallet',
          type: NetworkType.INTERNAL,
          rpc: 'internal',
          chainId: 'internal',
          visibility: EntityVisibility.Publish,
        }),
        app().get(TAccountService).topUp({
          type: WalletType.PERSONAL,
          value: 1,
          userId: user.profile.id,
        }),
      ]);

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'internal',
            address: receiver.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
        })
        .expect(204);

      await expect(
        app()
          .get(TAccountService)
          .getAccountBalance(user.profile.id, WalletType.PERSONAL),
      ).resolves.toEqual(0);
    });

    it('should return NO_CONTENT when external transaction has been reviewed successfully', async () => {
      const user = await registerUser();
      const receiver = await registerUser();

      await Promise.all([
        app()
          .get(getModelToken('Otp'))
          .create([
            {
              refCode: '123456',
              retry: 0,
              sentAt: [new Date()],
              action: OtpObjective.SEND_TOKEN,
              channel: TwilioChannel.EMAIL,
              receiver: user.profile.email,
              account: user.profile.id,
              expireDate: new Date('3000'),
            },
            {
              refCode: '123456',
              retry: 0,
              sentAt: [new Date()],
              action: OtpObjective.SEND_TOKEN,
              channel: TwilioChannel.SMS,
              receiver: '+66812341234',
              account: user.profile.id,
              expireDate: new Date('3000'),
            },
          ]),
        app().get(getModelToken('Network')).create({
          name: 'Castcle Mainnet',
          type: NetworkType.MAINNET,
          rpc: 'castcle.com',
          chainId: 'castcle',
          visibility: EntityVisibility.Publish,
        }),
        app().get(TAccountService).topUp({
          type: WalletType.PERSONAL,
          value: 1,
          userId: user.profile.id,
        }),
      ]);

      await request()
        .post('/v2/wallets/me/send/confirm')
        .auth(user.accessToken, { type: 'bearer' })
        .set({
          'Accept-Language': 'en',
          Device: 'CastclePhone',
          Platform: 'CastcleOS',
        })
        .send({
          transaction: {
            chainId: 'castcle',
            address: receiver.profile.id,
            amount: 1,
          },
          verification: {
            email: {
              email: user.profile.email,
              otp: '123456',
              refCode: '123456',
            },
            mobile: {
              countryCode: '+66',
              mobileNumber: '0812341234',
              otp: '123456',
              refCode: '123456',
            },
          },
        })
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
        })
        .expect(204);

      await expect(
        app()
          .get(TAccountService)
          .getAccountBalance(user.profile.id, WalletType.PERSONAL),
      ).resolves.toEqual(0);
    });
  });
