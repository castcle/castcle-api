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

import { Configs, Environment } from '@castcle-api/environments';
import { CastcleImage, Image } from '@castcle-api/utils/aws';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import { GetBalanceResponse, pipelineOfGetBalance } from '../aggregations';
import {
  Author,
  EntityVisibility,
  OwnerResponse,
  PublicUserResponse,
  SearchFollowsResponseDto,
  UserField,
} from '../dtos';
import { UserType } from '../models';
import { Relationship } from './relationship.schema';
import { SocialSync } from './social-sync.schema';
import { Transaction } from './transaction.schema';
import { User, UserSchema } from './user.schema';

export const UserSchemaFactory = (
  relationshipModel: Model<Relationship>,
  socialSyncModel: Model<SocialSync>,
  transactionModel: Model<Transaction>,
) => {
  UserSchema.pre('save', function (next) {
    if (!this.visibility) this.visibility = EntityVisibility.Publish;
    if (!this.followedCount) this.followedCount = 0;
    if (!this.followerCount) this.followerCount = 0;
    if (!this.verified)
      this.verified = {
        email: false,
        mobile: false,
        official: false,
        social: false,
      };
    next();
  });

  UserSchema.methods.toSearchTopTrendResponse = function () {
    return {
      id: this._id,
      castcleId: this.displayId,
      displayName: this.displayName,
      overview: this.profile?.overview || '',
      avatar: this.profile?.images?.avatar
        ? new Image(this.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      type: this.type,
      // TODO !!! need implement aggregator
      aggregator: {
        type: '',
        id: '',
        action: '',
        message: '',
      },
      verified:
        this.verified?.email ||
        this.verified?.mobile ||
        this.verified?.official,
      count: this.followerCount,
    } as SearchFollowsResponseDto;
  };

  UserSchema.methods.canUpdateCastcleId = function (): boolean {
    if (!this.displayIdUpdatedAt) return true;

    const now = DateTime.local();
    const canUpdateCastcleIdAt = DateTime.fromJSDate(
      this.displayIdUpdatedAt,
    ).plus({ days: Environment.CASTCLE_ID_ALLOW_UPDATE_DAYS });

    return canUpdateCastcleIdAt <= now;
  };

  UserSchema.methods.toAuthor = function () {
    return new Author({
      avatar: this.profile?.images?.avatar
        ? new Image(this.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      castcleId: this.displayId,
      displayName: this.displayName,
      id: this._id,
      type: this.type,
      verified: this.verified,
    });
  };

  UserSchema.methods.toPublicResponse = function (dto?): PublicUserResponse {
    return {
      id: this.id,
      castcleId: this.displayId,
      displayName: this.displayName,
      type: this.type,
      email: this.email,
      overview: this.profile?.overview,
      dob: this.profile?.birthdate,
      images: {
        avatar: this.profile?.images?.avatar
          ? CastcleImage.sign(this.profile.images.avatar)
          : Configs.DefaultAvatarImages,
        cover: this.profile?.images?.cover
          ? CastcleImage.sign(this.profile.images.cover)
          : Configs.DefaultAvatarCovers,
      },
      links: {
        ...this.profile?.socials,
        website: this.profile?.websites?.[0]?.website,
      },
      verified: { official: this.verified.official },
      followers: { count: this.followerCount },
      following: { count: this.followedCount },
      followed: dto?.followed,
      blocked: dto?.blocked,
      contact: this.contact,
      casts: this.casts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  };

  UserSchema.methods.toOwnerResponse = async function (
    this: User,
    dto?,
    account?,
  ): Promise<OwnerResponse> {
    const user = account ? this : await this.populate('ownerAccount');
    const ownerAccount = account || user.ownerAccount;
    const response: OwnerResponse = {
      ...this.toPublicResponse(),
      canUpdateCastcleId: this.canUpdateCastcleId(),
      passwordNotSet: !ownerAccount.password,
      verified: this.verified,
      pdpa: Boolean(ownerAccount.pdpa?.[Environment.PDPA_ACCEPT_DATES[0]]),
      reportedStatus: this.reportedStatus,
      reportedSubject: this.reportedSubject,
      mobile: ownerAccount.mobile,
    };

    if (!dto?.expansionFields?.length) return response;
    if (dto?.expansionFields.includes(UserField.LinkSocial)) {
      response.linkSocial = {};
      Object.entries(ownerAccount.authentications || {}).forEach(
        ([provider, authentication]) => {
          response.linkSocial[provider] = { socialId: authentication.socialId };
        },
      );
    }

    const $expansionFields = [];
    if (dto?.expansionFields.includes(UserField.SyncSocial)) {
      const $socialSyncs = async () => {
        const socialSyncs = await socialSyncModel.find({ user: this._id });
        socialSyncs.forEach((sync) => {
          (response.syncSocial ?? {})[sync.provider] =
            sync?.toSocialSyncPayload() || null;
        });
      };
      $expansionFields.push($socialSyncs());
    }

    if (dto?.expansionFields.includes(UserField.Wallet)) {
      const $balance = async () => {
        const [balance] = await transactionModel.aggregate<GetBalanceResponse>(
          pipelineOfGetBalance(this._id),
        );
        response.wallet = {
          balance: Number(balance?.total),
        };
      };
      $expansionFields.push($balance());
    }

    if ($expansionFields.length) await Promise.all($expansionFields);

    return response;
  };

  UserSchema.methods.follow = async function (followedUser) {
    const session = await relationshipModel.startSession();
    await session.withTransaction(async () => {
      ///TODO !!! Might have to change if relationship is embed
      const setObject = {
        user: this._id,
        followedUser: followedUser._id,
        isFollowPage: false,
        blocking: false,
        visibility: EntityVisibility.Publish,
      };
      if ((followedUser as User).type === UserType.PAGE)
        setObject.isFollowPage = true;
      const result = await relationshipModel
        .updateOne(
          {
            user: this._id,
            followedUser: followedUser._id,
          },
          {
            $setOnInsert: setObject,
            $set: { following: true },
          },
          {
            upsert: true,
          },
        )
        .exec();
      if (result.upsertedCount) {
        this.followedCount++;
        followedUser.followerCount++;
        await Promise.all([this.save(), followedUser.save()]);
      }
      await session.commitTransaction();
      await session.endSession();
    });
  };

  UserSchema.methods.unfollow = async function (followedUser) {
    const session = await relationshipModel.startSession();

    await session.withTransaction(async () => {
      const relationship = await relationshipModel
        .findOne({
          user: this._id,
          followedUser: followedUser._id,
          following: true,
        })
        .exec();

      if (!relationship) return;

      this.followedCount--;
      followedUser.followerCount--;

      const toSaves: Promise<any>[] = [this.save(), followedUser.save()];

      if (relationship.blocking || relationship.blocked) {
        relationship.following = false;
        toSaves.push(relationship.save());
      } else {
        toSaves.push(relationship.delete());
      }

      await Promise.all(toSaves);

      await session.commitTransaction();
      await session.endSession();
    });
  };

  return UserSchema;
};
