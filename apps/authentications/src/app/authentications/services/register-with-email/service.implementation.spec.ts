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
  Account,
  Analytic,
  DatabaseModule,
  EventName,
  QueueName,
  Repository,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { IpAPI } from '@castcle-api/utils/clients';
import { RegisterWithEmailServiceImpl } from './service.implementation';

describe('RegisterWithEmailServiceImpl', () => {
  let testing: TestingModule;
  let service: RegisterWithEmailServiceImpl;

  beforeAll(async () => {
    testing = await TestingModule.createWithDb({
      imports: [DatabaseModule],
      providers: [RegisterWithEmailServiceImpl],
    });

    service = testing.get(RegisterWithEmailServiceImpl);
  });

  afterAll(() => {
    return testing.close();
  });

  afterEach(() => {
    return testing.cleanDb();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw INVALID_ACCESS_TOKEN when guest token is invalid', async () => {
    await expect(
      service.execute({
        castcleId: 'caster',
        displayName: 'caster',
        email: 'caster@castcle.com',
        password: 'password',
        guestAccessToken: 'invalid-guest-access-token',
        hostUrl: '',
      }),
    ).rejects.toHaveProperty('code', 'INVALID_ACCESS_TOKEN');
  });

  it('should throw EMAIL_OR_PHONE_IS_EXIST when email is in use', async () => {
    const [guest, inUsed] = await Promise.all([
      testing.createGuest(),
      testing.createUser(),
    ]);

    await expect(
      service.execute({
        castcleId: 'caster',
        displayName: 'caster',
        email: inUsed.account.email,
        password: 'password',
        guestAccessToken: guest.accessToken,
        hostUrl: '',
      }),
    ).rejects.toHaveProperty('code', 'EMAIL_OR_PHONE_IS_EXIST');
  });

  it('should throw USER_ID_IS_EXIST when castcle ID is in use', async () => {
    const [guest, inUsed] = await Promise.all([
      testing.createGuest(),
      testing.createUser(),
    ]);

    await expect(
      service.execute({
        castcleId: inUsed.user.displayId,
        displayName: 'caster',
        email: 'caster@castcle.com',
        password: 'password',
        guestAccessToken: guest.accessToken,
        hostUrl: '',
      }),
    ).rejects.toHaveProperty('code', 'USER_ID_IS_EXIST');
  });

  it('should throw DUPLICATE_EMAIL when using temporary emails or aliases', async () => {
    const guest = await testing.createGuest();
    const TEMP_EMAIL_DISPOSABLE = Environment.EMAIL_DISPOSABLE;
    Environment.EMAIL_DISPOSABLE = 1;
    jest
      .spyOn(testing.get(Repository), 'isEmailDisposable')
      .mockResolvedValueOnce(true);

    await expect(
      service.execute({
        castcleId: 'caster',
        displayName: 'caster',
        email: 'caster@castcle.com',
        password: 'password',
        guestAccessToken: guest.accessToken,
        hostUrl: '',
      }),
    ).rejects.toHaveProperty('code', 'DUPLICATE_EMAIL');
    Environment.EMAIL_DISPOSABLE = TEMP_EMAIL_DISPOSABLE;
  });

  it('should create new user and return credential', async () => {
    jest
      .spyOn(testing.get(IpAPI), 'getGeolocation')
      .mockResolvedValueOnce({ countryCode: 'th', continentCode: 'as' });
    const guest = await testing.createGuest();
    const user = await service.execute({
      castcleId: 'caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
      password: 'password',
      guestAccessToken: guest.accessToken,
      hostUrl: '',
    });

    expect(user?.accessToken).toBeDefined();
    expect(user?.refreshToken).toBeDefined();
    expect(user?.pages).toEqual([]);
    expect(user?.profile).toMatchObject({
      castcleId: '@caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
    });
    expect(testing.getQueue(QueueName.VERIFY_EMAIL).add).toBeCalledWith(
      {
        hostUrl: '',
        toEmail: 'caster@castcle.com',
        accountId: guest._id.toString(),
      },
      { removeOnComplete: true },
    );
  });

  it('should create new user, update referral from body and return credential', async () => {
    const [guest, referrer] = await Promise.all([
      testing.createGuest(),
      testing.createUser(),
    ]);
    const user = await service.execute({
      castcleId: 'caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
      password: 'password',
      guestAccessToken: guest.accessToken,
      referral: referrer.user.displayId,
      hostUrl: '',
    });

    expect(user?.accessToken).toBeDefined();
    expect(user?.refreshToken).toBeDefined();
    expect(user?.pages).toEqual([]);
    expect(user?.profile).toMatchObject({
      castcleId: '@caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
    });

    const accountModel = testing.getModel<Account>('Account');
    const [invitee, inviter] = await Promise.all([
      accountModel.findById(guest._id),
      accountModel.findById(referrer.account._id),
    ]);

    expect({
      'invitee.referredBy': invitee.referralBy,
      'invitee.totalInvitees': invitee.referralCount,
      'inviter.referredBy': inviter.referralBy,
      'inviter.totalInvitees': inviter.referralCount,
    }).toEqual({
      'invitee.referredBy': inviter._id,
      'invitee.totalInvitees': 0,
      'inviter.referredBy': undefined,
      'inviter.totalInvitees': 1,
    });
  });

  it('should create new user, update referral from IP and return credential', async () => {
    const [guest, referrer] = await Promise.all([
      testing.createGuest(),
      testing.createUser(),
    ]);
    await testing.getModel<Analytic>('Analytic').create({
      name: EventName.INVITE_FRIENDS,
      ip: '::1',
      data: referrer.user.id,
    });
    const user = await service.execute({
      castcleId: 'caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
      password: 'password',
      guestAccessToken: guest.accessToken,
      ip: '::1',
      hostUrl: '',
    });

    expect(user?.accessToken).toBeDefined();
    expect(user?.refreshToken).toBeDefined();
    expect(user?.pages).toEqual([]);
    expect(user?.profile).toMatchObject({
      castcleId: '@caster',
      displayName: 'caster',
      email: 'caster@castcle.com',
    });

    const accountModel = testing.getModel<Account>('Account');
    const analyticModel = testing.getModel<Analytic>('Analytic');
    const [invitee, inviter, analytic] = await Promise.all([
      accountModel.findById(guest._id),
      accountModel.findById(referrer.account._id),
      analyticModel.findOne({ name: EventName.INVITE_FRIENDS }),
    ]);

    expect({
      'invitee.referredBy': invitee.referralBy,
      'invitee.totalInvitees': invitee.referralCount,
      'inviter.referredBy': inviter.referralBy,
      'inviter.totalInvitees': inviter.referralCount,
      'analytic.registeredAccount': analytic.registered.account,
    }).toEqual({
      'invitee.referredBy': inviter._id,
      'invitee.totalInvitees': 0,
      'inviter.referredBy': undefined,
      'inviter.totalInvitees': 1,
      'analytic.registeredAccount': invitee._id,
    });
  });
});
