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
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleQRCode, LocalizationLang } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GetUserRelationParamsV2,
  GetUserRelationResponseCount,
  pipelineOfUserRelationFollowersCountV2,
  pipelineOfUserRelationFollowersV2,
  pipelineOfUserRelationFollowingCountV2,
  pipelineOfUserRelationFollowingV2,
} from '../aggregations';
import {
  CastcleQueryOptions,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility,
  GetFollowQuery,
  GetKeywordQuery,
  Meta,
  NotificationSource,
  NotificationType,
  PageDto,
  PageResponseDto,
  PaginationQuery,
  QRCodeImageSize,
  ResponseDto,
  SortDirection,
  UpdateMobileDto,
  UserField,
  UserResponseDto,
} from '../dtos';
import { CampaignType, EngagementType, ReportType, UserType } from '../models';
import { Repository } from '../repositories';
import { Account, Relationship, User } from '../schemas';
import { AnalyticService } from './analytic.service';
import { CampaignService } from './campaign.service';
import { NotificationService } from './notification.service';

@Injectable()
export class UserServiceV2 {
  private logger = new CastLogger(UserServiceV2.name);

  constructor(
    @InjectModel('Relationship')
    private relationshipModel: Model<Relationship>,
    @InjectModel('User')
    private userModel: Model<User>,
    private analyticService: AnalyticService,
    private campaignService: CampaignService,
    private mailerService: Mailer,
    private notificationService: NotificationService,
    private repository: Repository,
  ) {}

  getUser = async (userId: string) => {
    const user = await this.repository.findUser({ _id: userId });
    if (!user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
    return user;
  };

  getPublicUser = async (
    requestedBy: User,
    userId: string,
    expansionFields?: UserField[],
  ) => {
    const [user] = await this.repository.getPublicUsers({
      requestedBy: requestedBy._id,
      filter: { _id: userId },
      expansionFields,
    });

    if (!user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    return user;
  };

  async getPublicUsers(
    requestedBy: User,
    filter: { _id: Types.ObjectId[] },
    queryOptions?: CastcleQueryOptions,
    expansionFields?: UserField[],
  ) {
    const total = await this.repository.findUserCount(filter);
    const sortKey = queryOptions.sortBy?.type === SortDirection.DESC ? -1 : 1;
    const users = await this.repository.getPublicUsers({
      requestedBy: requestedBy._id,
      filter,
      queryOptions: {
        limit: queryOptions.limit,
        skip: queryOptions.page - 1,
        sort: { [queryOptions.sortBy?.field ?? 'updatedAt']: sortKey },
      },
      expansionFields,
    });

    return {
      items: users,
      meta: Meta.fromDocuments(users, total),
    };
  }

  getUserRelationships = async (viewer: User, blocking: boolean) => {
    if (!viewer) return [];
    const isRelationships = await this.repository.findRelationships(
      {
        followedUser: viewer._id,
        blocking,
      },
      {
        projection: { user: 1 },
      },
    );

    const byRelationships = await this.repository.findRelationships(
      {
        userId: viewer._id,
        blocking,
      },
      {
        projection: { followedUser: 1 },
      },
    );
    return [
      ...isRelationships.map((item) => item.user._id),
      ...byRelationships.map((item) => item.followedUser._id),
    ];
  };

  /**
   * get all page it's own by user
   * @param user credential from request typeof Credential
   * @returns payload of result from user pages array typeof PageResponseDto[]
   */
  async getMyPages(requestedBy: User) {
    const filter = {
      accountId: requestedBy.ownerAccount._id,
      type: UserType.PAGE,
    };
    const pages = await this.repository.getPublicUsers({
      requestedBy: requestedBy._id,
      filter,
      expansionFields: [UserField.SyncSocial],
    });

    return pages;
  }

  async followUser(user: User, targetCastcleId: string, account: Account) {
    const followedUser = await this.repository.findUser({
      _id: targetCastcleId,
    });

    if (!followedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    await user.follow(followedUser);
    await this.notificationService.notifyToUser(
      {
        source:
          followedUser.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Follow,
        profileRef: followedUser._id,
        account: followedUser.ownerAccount,
        read: false,
      },
      followedUser,
      account.preferences?.languages[0] || LocalizationLang.English,
    );
  }

  async blockUser(user: User, targetCastcleId: string) {
    const blockUser = await this.repository
      .findUser({
        _id: targetCastcleId,
      })
      .exec();

    if (!blockUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const session = await this.relationshipModel.startSession();
    await session.withTransaction(async () => {
      await this.repository.updateRelationship(
        { user: user._id, followedUser: blockUser._id },
        {
          $setOnInsert: {
            user: user._id,
            followedUser: blockUser._id,
            visibility: EntityVisibility.Publish,
            blocked: false,
          },
          $set: { blocking: true, following: false },
        },
        { upsert: true, session },
      );
      await this.repository.updateRelationship(
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
        { upsert: true, session },
      );
    });
    session.endSession();
  }

  async unblockUser(user: User, targetCastcleId: string) {
    const unblockedUser = await this.repository.findUser({
      _id: targetCastcleId,
    });

    if (!unblockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const session = await this.relationshipModel.startSession();
    await session.withTransaction(async () => {
      const [blockerRelation, blockedRelation] = await Promise.all([
        this.repository.findRelationship(
          {
            user: user._id,
            followedUser: unblockedUser._id,
          },
          { session },
        ),
        this.repository.findRelationship(
          {
            user: unblockedUser._id,
            followedUser: user._id,
          },
          { session },
        ),
      ]);

      if (blockerRelation.following || blockerRelation.blocked) {
        await this.repository.updateRelationship(
          { _id: blockerRelation._id },
          { $set: { blocking: false } },
          { session },
        );
      } else {
        await this.repository.removeRelationship(
          { _id: blockerRelation._id },
          { session },
        );
      }

      if (blockedRelation.following || blockedRelation.blocking) {
        await this.repository.updateRelationship(
          {
            followedUser: user._id,
            user: unblockedUser._id,
            blocked: true,
          },
          { $set: { blocked: false } },
          { session },
        );
      } else {
        await this.repository.removeRelationship(
          { _id: blockedRelation._id },
          { session },
        );
      }
    });
    session.endSession();
  }

  async getBlockedLookup(
    user: User,
    { userFields, maxResults, sinceId, untilId }: PaginationQuery,
  ) {
    const filterQuery = {
      sinceId,
      untilId,
      userId: [user._id],
      blocking: true,
    };

    const relationships = await this.repository
      .findRelationships(filterQuery)
      .sort({ followedUser: SortDirection.DESC })
      .limit(maxResults)
      .exec();

    const userIds = relationships.map(
      ({ followedUser }) => followedUser as unknown as Types.ObjectId,
    );

    return this.getPublicUsers(user, { _id: userIds }, {}, userFields);
  }

  async unfollowUser(user: User, targetCastcleId: string) {
    const targetUser = await this.repository
      .findUser({ _id: targetCastcleId })
      .exec();

    if (!targetUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    await user.unfollow(targetUser);
  }

  async reportContent(user: User, targetContentId: string, message: string) {
    const targetContent = await this.repository.findContent({
      _id: targetContentId,
    });

    if (!targetContent) throw CastcleException.CONTENT_NOT_FOUND;

    const engagementFilter = {
      user: user._id,
      targetRef: { $ref: 'content', $id: targetContent._id },
      type: EngagementType.Report,
    };

    await this.repository
      .updateEngagement(
        engagementFilter,
        { ...engagementFilter, visibility: EntityVisibility.Publish },
        { upsert: true },
      )
      .exec();

    await this.mailerService.sendReportContentEmail(
      { _id: user._id, displayName: user.displayName },
      {
        _id: targetContent._id,
        payload: targetContent.payload,
        author: {
          _id: targetContent.author.id,
          displayName: targetContent.author.displayName,
        },
      },
      message,
    );

    await this.repository.createReporting({
      user: targetContent.author.id,
      type: ReportType.CONTENT,
      reported: targetContent,
      reportedBy: user._id,
      message,
    });
  }

  async reportUser(user: User, targetCastcleId: string, message: string) {
    const targetUser = await this.repository.findUser({
      _id: targetCastcleId,
    });

    if (!targetUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    await this.mailerService.sendReportUserEmail(
      { _id: user._id, displayName: user.displayName },
      { _id: targetUser._id, displayName: targetUser.displayName },
      message,
    );

    await this.repository.createReporting({
      user: targetUser._id,
      type: ReportType.USER,
      reported: targetUser,
      reportedBy: user._id,
      message,
    });
  }

  async updateMobile(
    account: Account,
    { objective, refCode, countryCode, mobileNumber }: UpdateMobileDto,
    ip: string,
  ) {
    if (account.isGuest) throw CastcleException.INVALID_ACCESS_TOKEN;

    const otp = await this.repository.findOtp({
      objective,
      receiver: countryCode + mobileNumber,
    });

    if (!otp?.isVerify) {
      throw CastcleException.INVALID_REF_CODE;
    }
    if (!otp.isValid()) {
      await otp.updateOne({ isVerify: false, retry: 0 });
      throw CastcleException.EXPIRED_OTP;
    }
    if (otp.refCode !== refCode) {
      await otp.failedToVerify().save();
      throw otp.exceededMaxRetries()
        ? CastcleException.OTP_USAGE_LIMIT_EXCEEDED
        : CastcleException.INVALID_REF_CODE;
    }

    await Promise.all([
      otp.markCompleted().save(),
      account.set({ mobile: { countryCode, number: mobileNumber } }).save(),
      this.userModel.updateMany(
        { ownerAccount: account._id },
        { 'verified.mobile': true },
      ),
      this.analyticService.trackMobileVerification(
        ip,
        account.id,
        countryCode,
        mobileNumber,
      ),
    ]);

    try {
      await this.campaignService.claimCampaignsAirdrop(
        account._id,
        CampaignType.VERIFY_MOBILE,
      );

      await this.campaignService.claimCampaignsAirdrop(
        String(account.referralBy),
        CampaignType.FRIEND_REFERRAL,
      );
    } catch (error: unknown) {
      this.logger.error(error, `updateMobile:claimAirdrop:error`);
    }
  }

  async deleteCastcleAccount(account: Account, password: string) {
    if (!account.verifyPassword(password)) {
      throw CastcleException.INVALID_PASSWORD;
    }

    await this.repository.deleteCastcleAccount(account);
  }

  async deletePage(account: Account, pageId: string, password: string) {
    const page = await this.repository.findUser({
      type: UserType.PAGE,
      _id: pageId,
    });

    if (!page) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
    if (String(page.ownerAccount) !== String(account._id)) {
      throw CastcleException.FORBIDDEN;
    }
    if (!account.verifyPassword(password)) {
      throw CastcleException.INVALID_PASSWORD;
    }

    await this.repository.deletePage(page._id);
  }

  async getUserByKeyword(
    { userFields, ...query }: GetKeywordQuery,
    requestedBy: User,
  ) {
    const blocking = await this.getUserRelationships(requestedBy, true);

    const users = await this.repository.getPublicUsers({
      requestedBy: requestedBy._id,
      filter: { excludeRelationship: blocking, ...query },
      expansionFields: userFields,
    });

    if (!users.length)
      return ResponseDto.ok({
        payload: [],
        meta: { resultCount: 0 },
      });

    return ResponseDto.ok({
      payload: users,
      meta: Meta.fromDocuments(users),
    });
  }

  async getFollowing(
    account: Account,
    targetUser: User,
    followQuery: GetFollowQuery,
  ) {
    const params: GetUserRelationParamsV2 = {
      userId: targetUser._id,
      limit: followQuery.maxResults ?? DEFAULT_QUERY_OPTIONS.limit,
      sinceId: followQuery.sinceId,
      untilId: followQuery.untilId,
      userTypes: followQuery.type,
      sortBy: followQuery.sort,
    };

    const [userRelation, userRelationCount, viewer] = await Promise.all([
      this.repository.aggregateRelationship<Relationship>(
        pipelineOfUserRelationFollowingV2(params),
      ),
      this.repository.aggregateRelationship<GetUserRelationResponseCount>(
        pipelineOfUserRelationFollowingCountV2(params),
      ),
      this.repository.findUser({ accountId: account._id }),
    ]);

    const followingUsersId = userRelation.flatMap(({ _id, followedUser }) => {
      return {
        userId: followedUser[0]?._id,
        relationshipId: _id,
      };
    });

    const users = await this.repository.getPublicUsers({
      requestedBy: viewer._id,
      filter: { _id: followingUsersId.map((f) => f.userId) },
      expansionFields: followQuery.userFields,
    });

    const relationTotal = userRelationCount[0]?.total ?? 0;

    return {
      users: this.mergeRelationUser(followingUsersId, users),
      meta: Meta.fromDocuments(userRelation, relationTotal),
    };
  }

  async getFollowers(
    account: Account,
    targetUser: User,
    followQuery: GetFollowQuery,
  ) {
    const params: GetUserRelationParamsV2 = {
      userId: targetUser._id,
      limit: followQuery.maxResults ?? DEFAULT_QUERY_OPTIONS.limit,
      sinceId: followQuery.sinceId,
      untilId: followQuery.untilId,
      userTypes: followQuery.type,
      sortBy: followQuery.sort,
    };

    const [userRelation, userRelationCount, viewer] = await Promise.all([
      this.repository.aggregateRelationship<Relationship>(
        pipelineOfUserRelationFollowersV2(params),
      ),

      this.repository.aggregateRelationship<GetUserRelationResponseCount>(
        pipelineOfUserRelationFollowersCountV2(params),
      ),

      this.repository.findUser({ accountId: account._id }),
    ]);

    const followingUsersId = userRelation.flatMap(({ _id, user }) => {
      return {
        userId: user[0]?._id,
        relationshipId: _id,
      };
    });

    const users = await this.repository.getPublicUsers({
      requestedBy: viewer._id,
      filter: { _id: followingUsersId.map((f) => f.userId) },
      expansionFields: followQuery.userFields,
    });

    const relationTotal = userRelationCount[0]?.total ?? 0;

    return {
      users: this.mergeRelationUser(followingUsersId, users),
      meta: Meta.fromDocuments(userRelation, relationTotal),
    };
  }

  mergeRelationUser(
    followingIds,
    users,
  ): (PageResponseDto | UserResponseDto)[] {
    const relationUsers = [];
    followingIds.forEach((follower) => {
      const user = users.find(
        (user) => String(user.id) === String(follower.userId),
      );

      if (user) {
        delete user.id;
        delete user.linkSocial;
        relationUsers.push({
          ...follower,
          ...user,
        });
      }
    });

    return relationUsers;
  }

  async createPage(user: User, body: PageDto) {
    const pageIsExist = await this.repository.findUser({
      _id: body.castcleId,
    });

    if (pageIsExist) throw CastcleException.PAGE_IS_EXIST;

    const page = await this.repository.createUser({
      ownerAccount: user.ownerAccount,
      type: UserType.PAGE,
      displayId: body.castcleId,
      displayName: body.displayName,
    });

    return page.toOwnerResponse();
  }

  async createQRCode(chainId: string, size: string, userId: string) {
    const user = await this.repository.findUser({ _id: userId });

    if (!user) throw CastcleException.USER_ID_IS_EXIST;

    const qrCodeParams = CastcleQRCode.generateQRCodeText([
      chainId,
      user._id,
      user.displayId,
    ]);

    return ResponseDto.ok({
      payload: await CastcleQRCode.generateQRCode(
        `${Environment.QR_CODE_REDIRECT_URL}${qrCodeParams}`,
        size ?? QRCodeImageSize.Thumbnail,
      ),
    });
  }

  async updatePDPA(date: string, account: Account) {
    await account.set(`pdpa.${date}`, true).save();
  }
}
