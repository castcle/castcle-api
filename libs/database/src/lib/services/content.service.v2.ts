import { UserService } from './user.service';
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
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EngagementType, UserType } from '../models';
import { Account, Comment, Content, Engagement, User } from '../schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  EntityVisibility,
  NotificationSource,
  NotificationType,
} from '../dtos';
import { Types } from 'mongoose';
import { ContentService } from './content.service';
import { NotificationServiceV2 } from './notification.service.v2';

@Injectable()
export class ContentServiceV2 {
  constructor(
    @InjectModel('Engagement')
    private _engagementModel: Model<Engagement>,
    @InjectModel('Comment')
    private _commentModel: Model<Comment>,
    @InjectModel('Content')
    private _contentModel: Model<Content>,
    private contentService: ContentService,
    private notificationServiceV2: NotificationServiceV2,
    private userService: UserService
  ) {}

  likeCast = async (content: Content, user: User, account: Account) => {
    const engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      type: EngagementType.Like,
    });
    if (engagement) throw CastcleException.LIKE_IS_EXIST;

    await new this._engagementModel({
      type: EngagementType.Like,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      visibility: EntityVisibility.Publish,
    }).save();

    if (String(user._id) === String(content.author.id)) return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id
    );
    await this.notificationServiceV2.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Like,
        contentRef: content._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      account.preferences.languages[0]
    );
    return content;
  };
  unlikeCast = async (contentId: string, user: User) => {
    const [content, engagement] = await Promise.all([
      this.contentService.getContentById(contentId),
      this._engagementModel.findOne({
        user: user._id,
        targetRef: {
          $ref: 'content',
          $id: Types.ObjectId(contentId),
        },
        type: EngagementType.Like,
      }),
    ]);

    if (!engagement) return;

    if (String(engagement.user) === String(content.author.id)) return;

    return engagement.remove();
  };
}
