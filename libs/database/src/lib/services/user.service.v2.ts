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
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CastcleQueryOptions,
  EntityVisibility,
  Meta,
  PageResponseDto,
  PaginationQuery,
  SortDirection,
  SyncSocialModelV2,
  UserField,
} from '../dtos';
import { UserType } from '../models';
import { Repository } from '../repositories';
import { Account, Relationship, SocialSync, User } from '../schemas';
import { ContentService } from './content.service';
import { UserService } from './user.service';

@Injectable()
export class UserServiceV2 {
  constructor(
    @InjectModel('Account')
    public _accountModel: Model<Account>,
    @InjectModel('Relationship')
    private _relationshipModel: Model<Relationship>,
    @InjectModel('SocialSync')
    private _socialSyncModel: Model<SocialSync>,
    @InjectModel('User')
    public _userModel: Model<User>,
    private contentService: ContentService,
    private repositoryService: Repository,
    private userService: UserService
  ) {}

  getUser = async (userId: string) => {
    const user = await this.userService.getByIdOrCastcleId(userId);
    if (!user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
    return user;
  };

  private async convertUsersToUserResponsesV2(
    viewer: User | null,
    users: User[],
    hasRelationshipExpansion = false,
    userFields?: UserField[]
  ) {
    if (!hasRelationshipExpansion && !userFields) {
      return Promise.all(
        users.map(async (user) => {
          return user.type === UserType.PAGE
            ? user.toPageResponseV2()
            : await user.toUserResponseV2();
        })
      );
    }

    const userIds = users.map((user) => user.id);

    const relationships = viewer
      ? await this._relationshipModel.find({
          $or: [
            { user: viewer._id, followedUser: { $in: userIds } },
            { user: { $in: userIds }, followedUser: viewer._id },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];

    return Promise.all(
      users.map(async (item) => {
        const syncSocials = userFields?.includes(UserField.SyncSocial)
          ? await this._socialSyncModel.find({ 'author.id': item.id }).exec()
          : [];

        let syncSocial: SyncSocialModelV2 = {};
        if (
          String(item.ownerAccount) === String(viewer.ownerAccount) &&
          syncSocials.length > 0
        ) {
          syncSocials.forEach((item) => {
            syncSocial[item.provider] = {
              id: item._id,
              provider: item.provider,
              socialId: item.socialId,
              userName: item.userName,
              displayName: item.displayName,
              avatar: item.avatar,
              active: item.active,
              autoPost: item.autoPost,
            };
          });
        } else {
          syncSocial = undefined;
        }
        const linkSocial = userFields?.includes(UserField.LinkSocial)
          ? String(item.ownerAccount) === String(viewer.ownerAccount)
            ? await this._accountModel
                .findOne({ _id: item.ownerAccount })
                .exec()
            : undefined
          : undefined;

        const content = userFields?.includes(UserField.Casts)
          ? await this.contentService.getContentsFromUser(item.id)
          : undefined;

        const balance = userFields?.includes(UserField.Wallet)
          ? await this.userService.getBalance(item)
          : undefined;

        const userResponse =
          item.type === UserType.PAGE
            ? item.toPageResponseV2(
                undefined,
                undefined,
                undefined,
                syncSocial,
                content?.total
              )
            : await item.toUserResponseV2({
                casts: content?.total,
                linkSocial: linkSocial?.authentications,
                syncSocial,
                balance,
              });

        const targetRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(user) === String(item.id) &&
                String(followedUser) === String(viewer?.id)
            )
          : undefined;

        const getterRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(followedUser) === String(item.id) &&
                String(user) === String(viewer?.id)
            )
          : undefined;

        userResponse.blocked = Boolean(getterRelationship?.blocking);
        userResponse.blocking = Boolean(targetRelationship?.blocking);
        userResponse.followed = Boolean(getterRelationship?.following);

        return userResponse;
      })
    );
  }

  getById = async (
    user: User,
    targetUser: User,
    hasRelationshipExpansion = false,
    userFields?: UserField[]
  ) => {
    if (!targetUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
    const [userResponse] = await this.convertUsersToUserResponsesV2(
      user,
      [targetUser],
      hasRelationshipExpansion,
      userFields
    );

    return userResponse;
  };

  /**
   * get all page it's own by user
   * @param user credential from request typeof Credential
   * @returns payload of result from user pages array typeof PageResponseDto[]
   */
  async getMyPages(user: User) {
    const filterQuery = {
      accountId: user.ownerAccount._id,
      type: UserType.PAGE,
    };
    const findUser = await this.repositoryService.findUsers(filterQuery);
    const pages = await this.convertUsersToUserResponsesV2(
      user,
      findUser,
      false,
      [UserField.SyncSocial]
    );

    return pages as PageResponseDto[];
  }

  async blockUser(user: User, targetCastcleId: string) {
    const blockUser = await this.repositoryService
      .findUser({
        _id: targetCastcleId,
      })
      .exec();

    if (!blockUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const session = await this._relationshipModel.startSession();
    await session.withTransaction(async () => {
      await this.repositoryService.updateRelationship(
        { user: user._id, followedUser: blockUser._id },
        {
          $setOnInsert: {
            user: user._id,
            followedUser: blockUser._id,
            visibility: EntityVisibility.Publish,
            following: false,
            blocked: false,
          },
          $set: { blocking: true },
        },
        { upsert: true, session }
      );
      await this.repositoryService.updateRelationship(
        { followedUser: user._id, user: blockUser._id },
        {
          $setOnInsert: {
            followedUser: user._id,
            user: blockUser._id,
            visibility: EntityVisibility.Publish,
            following: false,
            blocking: false,
          },
          $set: { blocked: true },
        },
        { upsert: true, session }
      );
    });
    session.endSession();
  }

  async unBlockUser(user: User, targetCastcleId: string) {
    const unblockedUser = await this.repositoryService.findUser({
      _id: targetCastcleId,
    });

    if (!unblockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const session = await this._relationshipModel.startSession();
    await session.withTransaction(async () => {
      await this.repositoryService.updateRelationship(
        {
          user: user._id,
          followedUser: unblockedUser._id,
          blocking: true,
        },
        { $set: { blocking: false } },
        { session }
      );
      await this.repositoryService.updateRelationship(
        {
          followedUser: user._id,
          user: unblockedUser._id,
          blocked: true,
        },
        { $set: { blocked: false } },
        { session }
      );
    });
    session.endSession();
  }

  async getBlockedLookup(
    user: User,
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery
  ) {
    const filterQuery = {
      sinceId,
      untilId,
      userId: [user._id],
      blocking: true,
    };

    const relationships = await this.repositoryService
      .findRelationships(filterQuery)
      .sort({ followedUser: SortDirection.DESC })
      .limit(maxResults)
      .exec();

    const userIds = relationships.map(
      ({ followedUser }) => followedUser as unknown as Types.ObjectId
    );

    return this.getByCriteria(
      user,
      { _id: userIds },
      {},
      hasRelationshipExpansion
    );
  }

  getByCriteria = async (
    viewer: User,
    query: { _id: Types.ObjectId[] },
    queryOptions?: CastcleQueryOptions,
    hasRelationshipExpansion = false,
    userFields?: UserField[]
  ) => {
    const { items: targetUsers, meta } = await this.getAllByCriteria(
      query,
      queryOptions
    );
    const users = await this.convertUsersToUserResponsesV2(
      viewer,
      targetUsers,
      hasRelationshipExpansion,
      userFields
    );
    return { users, meta };
  };

  getAllByCriteria = async (
    filterQuery: { _id: Types.ObjectId[] },
    queryOptions?: CastcleQueryOptions
  ) => {
    const total = await this.repositoryService.findUserCount(filterQuery);

    const sortKey = queryOptions.sortBy?.type === SortDirection.DESC ? -1 : 1;

    const users = await this.repositoryService.findUsers(filterQuery, {
      limit: queryOptions.limit,
      skip: queryOptions.page - 1,
      sort: { [queryOptions.sortBy?.field ?? 'updatedAt']: sortKey },
    });

    return {
      items: users,
      meta: Meta.fromDocuments(users, total),
    };
  };
}
