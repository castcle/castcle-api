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
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
} from '@castcle-api/utils/aws';
import { CastcleName, CastcleRegExp } from '@castcle-api/utils/commons';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isArray, isMongoId } from 'class-validator';
import {
  AnyKeys,
  FilterQuery,
  Model,
  QueryOptions,
  Types,
  UpdateQuery,
} from 'mongoose';
import { lastValueFrom, map } from 'rxjs';
import {
  GetAvailableIdResponse,
  pipelineOfGetAvailableId,
} from '../aggregations';
import { EntityVisibility } from '../dtos';
import { UserType } from '../models';
import {
  Account,
  Content,
  Credential,
  Engagement,
  Relationship,
  User,
  Notification,
} from '../schemas';
import { createCastcleFilter } from '../utils/common';
import {
  NotificationSource,
  NotificationType,
} from './../dtos/notification.dto';

type AccountQuery = {
  _id?: string;
  email?: string;
  provider?: string;
  socialId?: string;
};

type UserQuery = {
  /** Mongo ID or castcle ID */
  _id?: string | Types.ObjectId[];
  accountId?: string;
  type?: UserType;
};

type EngagementQuery = {
  contentId: string;
  type: string;
  sinceId?: string;
  untilId?: string;
};

type RelationshipQuery = {
  userId: User[];
};

type CredentialQuery = {
  refreshToken?: string;
  accessToken?: string;
};

type NotificationQueryOption = {
  _id?: string;
  account?: Account;
  source?: NotificationSource;
  sinceId?: string;
  untilId?: string;
  read?: boolean;
  type?: NotificationType;
  contentRef?: Types.ObjectId | any;
  commentRef?: Types.ObjectId | any;
  replyRef?: Types.ObjectId | any;
  adsRef?: Types.ObjectId | any;
  profileRef?: Types.ObjectId | any;
  sourceUserId?: Types.ObjectId;
};
@Injectable()
export class Repository {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('Content') private contentModel: Model<Content>,
    @InjectModel('Credential') private credentialModel: Model<Credential>,
    @InjectModel('Engagement') private engagementModel: Model<Engagement>,
    @InjectModel('Relationship') private relationshipModel: Model<Relationship>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Notification') private notificationModel: Model<Notification>,
    private httpService: HttpService
  ) {}

  private getBase64FromUrl(url: string) {
    return lastValueFrom(
      this.httpService
        .get(url, {
          responseType: 'arraybuffer',
        })
        .pipe(map(({ data }) => Buffer.from(data, 'binary').toString('base64')))
    );
  }

  private getAccountQuery(filter: AccountQuery) {
    const query: FilterQuery<Account> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter._id) query._id = filter._id;
    if (filter.email) query.email = CastcleRegExp.fromString(filter.email);
    if (filter.provider && filter.socialId) {
      query[`authentications.${filter.provider}.socialId`] = filter.socialId;
    }
    return query;
  }

  private getRelationshipsQuery = (filter: RelationshipQuery) => {
    return { user: { $in: filter.userId } };
  };

  private getEngagementsQuery = (filter: EngagementQuery) => {
    const query: FilterQuery<Engagement> = {
      type: filter.type,
      targetRef: {
        $ref: 'content',
        $id: Types.ObjectId(filter.contentId),
      },
    };
    if (filter.sinceId && filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  };

  private getNotificationQuery = (filter: NotificationQueryOption) => {
    const query: FilterQuery<Notification> = {};
    if (filter?._id) query._id = filter._id;
    if (filter?.account) query.account = filter.account;
    if (filter?.source) query.source = filter.source;
    if (filter?.read) query.read = filter.read;
    if (filter?.type) query.type = filter.type;
    if (filter?.contentRef) query.contentRef = filter.contentRef;
    if (filter?.commentRef) query.commentRef = filter.commentRef;
    if (filter?.replyRef) query.replyRef = filter.replyRef;
    if (filter?.profileRef) query.profileRef = filter.profileRef;
    if (filter?.adsRef) query.adsRef = filter.adsRef;
    if (filter?.sourceUserId) query.sourceUserId = filter.sourceUserId;

    return createCastcleFilter(query, {
      sinceId: filter?.sinceId,
      untilId: filter?.untilId,
    });
  };
  deleteAccount(filter: AccountQuery) {
    return this.accountModel.deleteOne(this.getAccountQuery(filter));
  }

  findAccount(filter: AccountQuery) {
    return this.accountModel.findOne(this.getAccountQuery(filter));
  }

  findAccounts(filter: AccountQuery) {
    return this.accountModel.find(this.getAccountQuery(filter));
  }

  updateAccount(filter: AccountQuery, updateQuery: UpdateQuery<Account>) {
    return this.accountModel.updateOne(
      this.getAccountQuery(filter),
      updateQuery
    );
  }

  updateCredentials(
    filter: FilterQuery<Credential>,
    updateQuery: UpdateQuery<Credential>
  ) {
    return this.credentialModel.updateMany(filter, updateQuery);
  }

  async createProfileImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `avatar-${accountId}`,
      addTime: true,
      sizes: AVATAR_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createCoverImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `cover-${accountId}`,
      addTime: true,
      sizes: COMMON_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createUser(user: AnyKeys<User>) {
    const { suggestCastcleId } = new CastcleName(
      user.displayId || user.displayName
    );
    const [availableId] =
      await this.userModel.aggregate<GetAvailableIdResponse>(
        pipelineOfGetAvailableId(suggestCastcleId)
      );

    user.displayId = availableId?.count
      ? suggestCastcleId + (availableId.number || Date.now().toString())
      : suggestCastcleId;

    return new this.userModel(user).save();
  }

  private getUserQuery(filter: UserQuery) {
    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.accountId) query.ownerAccount = filter.accountId as any;
    if (filter.type) query.type = filter.type;
    if (isMongoId(String(filter._id))) query._id = filter._id;
    if (isArray(filter._id)) query._id = { $in: filter._id };
    else if (filter._id)
      query.displayId = CastcleRegExp.fromString(filter._id as string);

    return query;
  }

  findUser(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.findOne(this.getUserQuery(filter), {}, queryOptions);
  }

  findUsers(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.find(this.getUserQuery(filter), {}, queryOptions);
  }

  findEngagement(filter: EngagementQuery, queryOptions?: QueryOptions) {
    return this.engagementModel
      .find(this.getEngagementsQuery(filter), {}, queryOptions)
      .exec();
  }

  findEngagementCount(filter: EngagementQuery) {
    return this.engagementModel
      .countDocuments(this.getEngagementsQuery(filter))
      .exec();
  }

  findRelationships(filter: RelationshipQuery, queryOptions?: QueryOptions) {
    return this.relationshipModel
      .find(this.getRelationshipsQuery(filter), {}, queryOptions)
      .exec();
  }
  findContentById(contentId: string) {
    return this.contentModel.findById(contentId).exec();
  }

  findCredential(filter: CredentialQuery) {
    return this.credentialModel.findOne(filter);
  }

  createNotification(notify: AnyKeys<Notification>) {
    return new this.notificationModel(notify).save();
  }

  findNotification(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions
  ) {
    return this.notificationModel
      .findOne(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  findNotifications(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions
  ) {
    return this.notificationModel
      .find(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  updateNotification(
    filter: NotificationQueryOption,
    updateQuery: UpdateQuery<Notification>,
    queryOptions?: QueryOptions
  ) {
    return this.notificationModel.updateOne(
      this.getNotificationQuery(filter),
      updateQuery,
      queryOptions
    );
  }

  updateNotifications(
    filter: NotificationQueryOption,
    updateQuery: UpdateQuery<Notification>,
    queryOptions?: QueryOptions
  ) {
    return this.notificationModel.updateMany(
      this.getNotificationQuery(filter),
      updateQuery,
      queryOptions
    );
  }

  deleteNotification(filter: NotificationQueryOption) {
    return this.notificationModel.deleteOne(this.getNotificationQuery(filter));
  }

  deleteNotifications(filter: NotificationQueryOption) {
    return this.notificationModel.deleteMany(this.getNotificationQuery(filter));
  }

  aggregationNotification(pipeline: any[]) {
    return this.notificationModel.aggregate(pipeline);
  }

  findNotificationCount(filter: NotificationQueryOption) {
    return this.notificationModel
      .countDocuments(this.getNotificationQuery(filter))
      .exec();
  }
}
