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

import { Password } from '@castcle-api/common';
import {
  Account,
  Analytic,
  EntityVisibility,
  EventName,
  QueueName,
  Repository,
  UserField,
  UserType,
  VerifyEmailMessage,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { IpAPI } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import {
  RegisterWithEmailDto as RegisterWithEmailDto,
  RegisterWithEmailService,
} from './service.abstract';

@Injectable()
export class RegisterWithEmailServiceImpl implements RegisterWithEmailService {
  constructor(
    private ipAPI: IpAPI,
    private repository: Repository,
    @InjectModel('Account')
    private accountModel: Model<Account>,
    @InjectModel('Analytic')
    private analyticModel: Model<Analytic>,
    @InjectQueue(QueueName.VERIFY_EMAIL)
    private emailVerifier: Queue<VerifyEmailMessage>,
  ) {}

  async execute(dto: RegisterWithEmailDto) {
    const [
      account,
      emailAlreadyExists,
      castcleIdAlreadyExists,
      geolocation,
      isEmailDisposable,
      referrer,
    ] = await Promise.all([
      this.accountModel.findOne({
        isGuest: true,
        visibility: EntityVisibility.Publish,
        'credentials.accessToken': dto.guestAccessToken,
        'credentials.accessTokenExpiration': { $gte: new Date() },
      }),
      this.repository.findAccount({ email: dto.email }),
      this.repository.findUser({ _id: dto.castcleId }),
      this.ipAPI.getGeolocation(dto.ip),
      this.repository.isEmailDisposable(dto.email),
      this.getReferrer(dto.referral, dto.ip),
    ]);

    if (!account) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
    if (emailAlreadyExists) {
      throw new CastcleException('EMAIL_OR_PHONE_IS_EXIST');
    }
    if (castcleIdAlreadyExists) {
      throw new CastcleException('USER_ID_IS_EXIST');
    }
    if (isEmailDisposable) {
      throw new CastcleException('DUPLICATE_EMAIL');
    }

    account.isGuest = false;
    account.email = dto.email;
    account.password = Password.hash(dto.password);
    account.referralBy = referrer?._id;

    if (geolocation) {
      account.geolocation = geolocation;
    }
    if (Environment.PDPA_ACCEPT_DATES.length) {
      account.set(`pdpa.${Environment.PDPA_ACCEPT_DATES[0]}`, true);
    }

    const user = await this.repository.createUser({
      ownerAccount: account._id,
      displayId: dto.castcleId,
      displayName: dto.displayName,
      type: UserType.PEOPLE,
      email: dto.email,
    });

    const [token, userResponse] = await Promise.all([
      account.regenerateToken({ accessToken: dto.guestAccessToken }),
      user.toOwnerResponse(
        {
          expansionFields: [
            UserField.LinkSocial,
            UserField.SyncSocial,
            UserField.Wallet,
          ],
        },
        account,
      ),
      this.analyticModel.updateMany(
        { ip: dto.ip, registered: { $exists: false } },
        { registered: { account: account._id } },
      ),
      this.emailVerifier.add(
        {
          hostUrl: dto.hostUrl,
          toEmail: dto.email,
          accountId: account.id,
        },
        { removeOnComplete: true },
      ),
      referrer?.update({ $inc: { referralCount: 1 } }),
    ]);

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile: userResponse,
      pages: [],
    };
  }

  private async getReferrer(referrerCastcleId?: string, ip?: string) {
    const $referrerFromId = () => {
      return referrerCastcleId
        ? this.repository.findUser({ _id: referrerCastcleId })
        : null;
    };
    const $referrerFromIp = async () => {
      const analytic = ip
        ? await this.analyticModel.findOne(
            { ip, name: EventName.INVITE_FRIENDS },
            {},
            { sort: { createdAt: -1 } },
          )
        : null;
      if (!analytic) return;
      return this.repository.findUser({ _id: analytic?.data });
    };

    const referrer = (await $referrerFromId()) || (await $referrerFromIp());

    if (!referrer) return;

    return this.repository.findAccount({ _id: referrer.ownerAccount });
  }
}
