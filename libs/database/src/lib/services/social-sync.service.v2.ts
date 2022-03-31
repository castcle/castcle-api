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

import { FacebookClient } from '@castcle-api/utils/clients';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntityVisibility, SyncSocialDtoV2 } from '../dtos';
import { SocialProvider } from '../models';
import { SocialSync } from '../schemas';

@Injectable()
export class SocialSyncServiceV2 {
  constructor(
    @InjectModel('SocialSync') private socialSyncModel: Model<SocialSync>,
    private facebookClient: FacebookClient
  ) {}

  async sync(userId: string, socialSyncDto: SyncSocialDtoV2) {
    const socialSync = await this.socialSyncModel.findOne({
      'author.id': userId,
      provider: socialSyncDto.provider,
      visibility: EntityVisibility.Publish,
    });

    if (socialSync) {
      await this.unsync(socialSync);
    }

    if (
      socialSyncDto.provider === SocialProvider.Facebook &&
      socialSyncDto.autoPost
    ) {
      await this.facebookClient.subscribeApps(
        socialSyncDto.authToken,
        socialSyncDto.socialId
      );
    }

    return {
      duplicate: Boolean(socialSync),
      socialSync: await new this.socialSyncModel({
        ...socialSyncDto,
        author: { id: userId },
        visibility: EntityVisibility.Publish,
      }).save(),
    };
  }

  async unsync(socialSync: SocialSync) {
    if (
      socialSync.provider === SocialProvider.Facebook &&
      socialSync.autoPost
    ) {
      await this.facebookClient.unsubscribeApps(
        socialSync.authToken,
        socialSync.socialId
      );
    }

    await socialSync.set({ visibility: EntityVisibility.Deleted }).save();
  }
}
