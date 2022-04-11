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
import { CastLogger } from '@castcle-api/logger';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import { EntityVisibility, SyncSocialModelV2, UserField } from '../dtos';
import { QueueName, UserMessage, UserType } from '../models';
import { Relationship, SocialSync, Transaction, User } from '../schemas';
import { ContentService } from './content.service';
import { UserService } from './user.service';

@Injectable()
export class UserServiceV2 {
  private = new CastLogger(UserServiceV2.name);

  constructor(
    @InjectModel('Relationship')
    private _relationshipModel: Model<Relationship>,
    @InjectModel('SocialSync')
    private _socialSyncModel: Model<SocialSync>,
    @InjectModel('Transaction')
    private transactionModel: Model<Transaction>,
    @InjectModel('User')
    public _userModel: Model<User>,
    @InjectQueue(QueueName.USER)
    private userQueue: Queue<UserMessage>,
    private contentService: ContentService,
    private userService: UserService
  ) {}

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
      users.map(async (user) => {
        const syncSocials = userFields?.includes(UserField.SyncSocial)
          ? await this._socialSyncModel.find({ 'author.id': user.id }).exec()
          : undefined;

        let syncSocial = new SyncSocialModelV2();
        syncSocials
          ? syncSocials.forEach((item) => {
              String(user.ownerAccount) === String(viewer.ownerAccount)
                ? (syncSocial[item.provider] = {
                    provider: item.provider,
                    socialId: item.socialId,
                    userName: item.userName,
                    displayName: item.displayName,
                    avatar: item.avatar,
                    active: item.active,
                    autoPost: item.autoPost,
                  })
                : (syncSocial = undefined);
            })
          : undefined;

        const content = userFields?.includes(UserField.Casts)
          ? await this.contentService.getContentsFromUser(user.id)
          : undefined;

        const balance = userFields?.includes(UserField.Wallet)
          ? await this.userService.getBalance(user)
          : undefined;

        const userResponse =
          user.type === UserType.PAGE
            ? user.toPageResponseV2(
                undefined,
                undefined,
                undefined,
                syncSocial,
                content?.total
              )
            : await user.toUserResponseV2({
                casts: content?.total,
                syncSocial,
                balance,
              });

        const targetRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(user) === String(user.id) &&
                String(followedUser) === String(viewer?.id)
            )
          : undefined;

        const getterRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(followedUser) === String(user.id) &&
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
    id: string,
    type?: UserType,
    hasRelationshipExpansion = false,
    userFields?: UserField[]
  ) => {
    const targetUser = await this.userService.getByIdOrCastcleId(id, type);

    if (!targetUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const [userResponse] = await this.convertUsersToUserResponsesV2(
      user,
      [targetUser],
      hasRelationshipExpansion,
      userFields
    );

    return userResponse;
  };
}
