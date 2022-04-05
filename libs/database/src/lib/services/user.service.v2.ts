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
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
} from '@castcle-api/utils/aws';
import { CastcleRegExp } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { isMongoId } from 'class-validator';
import { FilterQuery, Model } from 'mongoose';
import {
  CastcleQueueAction,
  EntityVisibility,
  UpdateUserDtoV2,
  UpdateModelUserDto,
  UserField,
  UserModelImage,
} from '../dtos';
import { QueueName, UserMessage, UserType } from '../models';
import {
  Comment,
  Content,
  Credential,
  Relationship,
  SocialSync,
  User,
} from '../schemas';
import { ContentService } from './content.service';

@Injectable()
export class UserServiceV2 {
  private logger = new CastLogger(UserServiceV2.name);

  constructor(
    @InjectModel('Comment')
    private commentModel: Model<Comment>,
    @InjectModel('Content')
    private contentModel: Model<Content>,
    @InjectModel('Relationship')
    private _relationshipModel: Model<Relationship>,
    @InjectModel('SocialSync')
    private _socialSyncModel: Model<SocialSync>,

    @InjectModel('User')
    private _userModel: Model<User>,
    @InjectQueue(QueueName.USER)
    private userQueue: Queue<UserMessage>,
    private contentService: ContentService
  ) {}

  getUserFromCredential = (credential: Credential) =>
    this._userModel
      .findOne({
        ownerAccount: credential?.account?._id,
        type: UserType.PEOPLE,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  private async convertUsersToUserResponses(
    viewer: User | null,
    users: User[],
    hasRelationshipExpansion = false,
    userFields?: UserField[]
  ) {
    if (!hasRelationshipExpansion && !userFields) {
      return Promise.all(
        users.map(async (user) => {
          return user.type === UserType.PAGE
            ? user.toPageResponse()
            : await user.toUserResponse();
        })
      );
    }

    const userIds: any[] = users.map((user) => user.id);
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
      users.map(async (u) => {
        const syncSocial = userFields?.includes(UserField.SyncSocial)
          ? await this._socialSyncModel.findOne({ 'author.id': u.id }).exec()
          : undefined;

        const content = userFields?.includes(UserField.Casts)
          ? await this.contentService.getContentsFromUser(u.id)
          : undefined;

        const userResponse =
          u.type === UserType.PAGE
            ? u.toPageResponse(
                undefined,
                undefined,
                undefined,
                syncSocial,
                content?.total
              )
            : await u.toUserResponse({ casts: content?.total });

        const targetRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(user) === String(u.id) &&
                String(followedUser) === String(viewer?.id)
            )
          : undefined;

        const getterRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(followedUser) === String(u.id) &&
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

  getByIdOrCastcleId = (id: string, type?: UserType) => {
    if (!id) return null;

    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (type) query.type = type;
    if (isMongoId(String(id))) query._id = id;
    else query.displayId = CastcleRegExp.fromString(id);

    return this._userModel.findOne(query).exec();
  };

  /**
   * @param {string} id user ID or Castcle ID
   * @param {UserType} type user type: `people` or `page`
   * @throws {CastcleException} with CastcleStatus.REQUEST_URL_NOT_FOUND
   */
  findUser = async (id: string, type?: UserType) => {
    const user = await this.getByIdOrCastcleId(id, type);

    if (!user) throw CastcleException.REQUEST_URL_NOT_FOUND;

    return user;
  };

  updateUser = (
    user: User,
    { images, links, ...updateUserDto }: UpdateModelUserDto
  ) => {
    user.displayIdUpdatedAt = new Date();

    if (images) {
      if (!user.profile.images) user.profile.images = {};
      if (images.avatar) user.profile.images.avatar = images.avatar;
      if (images.cover) user.profile.images.cover = images.cover;
    }

    if (links) {
      if (!user.profile.socials) user.profile.socials = {};
      const socialNetworks = ['facebook', 'medium', 'twitter', 'youtube'];
      socialNetworks.forEach((social) => {
        if (links[social]) user.profile.socials[social] = links[social];
        if (links.website)
          user.profile.websites = [
            {
              website: links.website,
              detail: links.website,
            },
          ];
      });
    }

    user.set(updateUserDto);
    user.markModified('profile');
    this.userQueue.add({
      id: user._id,
      action: CastcleQueueAction.UpdateProfile,
    });

    return user.save();
  };

  async uploadUserInfo(body: UpdateUserDtoV2, accountId: string) {
    const images: UserModelImage = {};
    if (body.images?.avatar) {
      const avatar = await Image.upload(body.images.avatar, {
        filename: `avatar-${accountId}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `account_${accountId}`,
      });

      images.avatar = avatar.image;
    }

    if (body.images?.cover) {
      const cover = await Image.upload(body.images.cover, {
        filename: `cover-${accountId}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `account_${accountId}`,
      });

      images.cover = cover.image;
    }

    return { ...body, images };
  }
}
