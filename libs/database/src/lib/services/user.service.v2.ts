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
  CastcleLogger,
  CastcleQRCode,
  LocalizationLang,
} from '@castcle-api/common';
import { Environment } from '@castcle-api/environments';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Downloader,
  Image,
} from '@castcle-api/utils/aws';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
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
  CastcleQueueAction,
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
  ReportUserDto,
  ResponseDto,
  SocialPageDto,
  SortDirection,
  SyncSocialDtoV2,
  UpdateModelUserDto,
  UserField,
  UserResponseDto,
} from '../dtos';
import {
  AccountActivationType,
  MetadataType,
  QueueName,
  ReportingAction,
  ReportingMessage,
  ReportingStatus,
  ReportingType,
  UserMessage,
  UserType,
} from '../models';
import { Repository } from '../repositories';
import { Account, Relationship, User } from '../schemas';
import { getSocialPrefix } from '../utils/common';
import { AnalyticService } from './analytic.service';
import { NotificationServiceV2 } from './notification.service.v2';
import { SocialSyncServiceV2 } from './social-sync.service.v2';

@Injectable()
export class UserServiceV2 {
  private logger = new CastcleLogger(UserServiceV2.name);

  constructor(
    @InjectModel('Relationship')
    private relationshipModel: Model<Relationship>,
    @InjectModel('User')
    private userModel: Model<User>,
    @InjectQueue(QueueName.REPORTING)
    private reportingQueue: Queue<ReportingMessage>,
    @InjectQueue(QueueName.USER)
    private userQueue: Queue<UserMessage>,
    private analyticService: AnalyticService,
    private download: Downloader,
    private mailerService: Mailer,
    private notificationService: NotificationServiceV2,
    private repository: Repository,
    private socialSyncService: SocialSyncServiceV2,
  ) {}

  getUser = async (userId: string) => {
    const user = await this.repository.findUser({
      _id: userId,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });
    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    return user;
  };

  getUserByAccount = (accountId: Types.ObjectId) => {
    return this.repository.findUser({ accountId });
  };

  getUserOnly = async (userId: string) => {
    const user = await this.repository.findUser({
      _id: userId,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });
    return user;
  };

  getPublicUser = async (
    requestedBy: User,
    userId: string,
    expansionFields?: UserField[],
  ) => {
    const [user] = await this.repository.getPublicUsers({
      requestedBy: requestedBy,
      filter: {
        _id: userId,
        visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
      },
      expansionFields,
    });

    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

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
      requestedBy: requestedBy,
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
      requestedBy,
      filter,
      expansionFields: [UserField.SyncSocial],
    });

    return pages;
  }

  async followUser(user: User, targetCastcleId: string, account: Account) {
    const followedUser = await this.repository.findUser({
      _id: targetCastcleId,
    });

    if (!followedUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (followedUser.id === user.id) throw new CastcleException('FORBIDDEN');

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

    if (!blockUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (blockUser.id === user.id) throw new CastcleException('FORBIDDEN');

    const session = await this.relationshipModel.startSession();
    await session.withTransaction(async () => {
      const [followed, follower] = await Promise.all([
        this.repository.findRelationships({
          userId: user._id,
          followedUser: blockUser._id,
          following: true,
        }),
        this.repository.findRelationships({
          userId: blockUser._id,
          followedUser: user._id,
          following: true,
        }),
      ]);

      if (followed.length) {
        user.followedCount--;
        blockUser.followerCount--;
      }

      if (follower.length) {
        user.followerCount--;
        blockUser.followedCount--;
      }

      await Promise.all([
        user.save({ session }),
        blockUser.save({ session }),
        this.repository.updateRelationship(
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
        ),
        this.repository.updateRelationship(
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
        ),
      ]);
      await session.commitTransaction();
      await session.endSession();
    });
  }

  async unblockUser(user: User, targetCastcleId: string) {
    const unblockedUser = await this.repository.findUser({
      _id: targetCastcleId,
    });

    if (!unblockedUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

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
        await this.repository.deleteRelationship(
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
        await this.repository.deleteRelationship(
          { _id: blockedRelation._id },
          { session },
        );
      }
    });
    await session.endSession();
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

    if (!targetUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    await user.unfollow(targetUser);
  }

  async reportUser(requestedBy: User, body: ReportUserDto) {
    const targetUser = await this.repository
      .findUser({
        _id: body.targetCastcleId,
      })
      .exec();

    if (!targetUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (targetUser.id === requestedBy.id)
      throw new CastcleException('FORBIDDEN');

    const reportingExists = await this.repository.findReporting({
      by: requestedBy._id,
      payloadId: targetUser._id,
      subject: body.subject,
      user: targetUser._id,
    });

    if (reportingExists) throw new CastcleException('REPORTING_IS_EXIST');

    const reportingSubject = await this.repository.findReportingSubject({
      type: MetadataType.REPORTING_SUBJECT,
      subject: body.subject,
    });

    if (!reportingSubject)
      throw new CastcleException('REPORTING_SUBJECT_NOT_FOUND');

    await Promise.all([
      this.repository.createReporting({
        by: requestedBy._id,
        message: body.message,
        payload: targetUser,
        subject: body.subject,
        type: ReportingType.USER,
        user: targetUser._id,
      }),
      this.reportingQueue.add(
        {
          subject: `${ReportingAction.REPORT} user : (OID : ${targetUser._id})`,
          content: this.mailerService.generateHTMLReport(
            targetUser.toPublicResponse(),
            {
              action: ReportingAction.REPORT,
              message: body.message,
              reportedBy: requestedBy.displayName,
              subject: reportingSubject.payload.name,
              type: ReportingType.USER,
              user: {
                id: targetUser.id,
                castcleId: targetUser.displayId,
                displayName: targetUser.displayName,
              },
            },
          ),
        },
        {
          removeOnComplete: true,
        },
      ),
    ]);
  }

  async updateEmail(
    account: Account,
    user: User,
    email: string,
    hostUrl: string,
  ) {
    if (account.isGuest) throw new CastcleException('INVALID_ACCESS_TOKEN');

    const emailAlreadyExists = await this.repository.findAccount({ email });
    if (emailAlreadyExists) throw new CastcleException('DUPLICATE_EMAIL');

    if ([user.verified.email, user.email].some((email) => email))
      throw new CastcleException('EMAIL_CAN_NOT_CHANGE');

    const { verifyToken } = account.createActivation(
      AccountActivationType.EMAIL,
    );

    account.email = email;
    user.email = email;
    account.markModified('activations');

    await Promise.all([account.save(), user.save()]);

    await this.mailerService.sendRegistrationEmail(hostUrl, email, verifyToken);

    return user.toOwnerResponse();
  }
  async deleteCastcleAccount(account: Account, password: string) {
    if (!account.verifyPassword(password)) {
      throw new CastcleException('INVALID_PASSWORD');
    }

    await this.repository.deleteCastcleAccount(account);
  }

  async deletePage(account: Account, pageId: string, password: string) {
    const page = await this.repository.findUser({
      type: UserType.PAGE,
      _id: pageId,
    });

    if (!page) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    if (String(page.ownerAccount) !== String(account._id)) {
      throw new CastcleException('FORBIDDEN');
    }
    if (!account.verifyPassword(password)) {
      throw new CastcleException('INVALID_PASSWORD');
    }

    await this.repository.deletePage(page._id);
  }

  async getUserByKeyword(
    { userFields, maxResults, ...query }: GetKeywordQuery,
    requestedBy: User,
  ) {
    const blocking = await this.getUserRelationships(requestedBy, true);

    const users = await this.repository.getPublicUsers({
      requestedBy: requestedBy,
      filter: { excludeRelationship: blocking, ...query },
      queryOptions: { limit: maxResults, sort: { createdAt: -1 } },
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
        id: followedUser[0]?._id,
        relationshipId: _id,
      };
    });

    const users = await this.repository.getPublicUsers({
      requestedBy: viewer,
      filter: { _id: followingUsersId.map((f) => f.id) },
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
        id: user[0]?._id,
        relationshipId: _id,
      };
    });

    const users = await this.repository.getPublicUsers({
      requestedBy: viewer,
      filter: { _id: followingUsersId.map((f) => f.id) },
      expansionFields: followQuery.userFields,
    });

    const relationTotal = userRelationCount[0]?.total ?? 0;

    return {
      users: this.mergeRelationUser(followingUsersId, users),
      meta: Meta.fromDocuments(userRelation, relationTotal),
    };
  }

  mergeRelationUser(
    followingIds: { id: string; relationshipId: string }[],
    users,
  ): (PageResponseDto | UserResponseDto)[] {
    const relationUsers = [];
    followingIds.forEach((follower) => {
      const user = users.find(
        (user) => String(user.id) === String(follower.id),
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

    if (!user) throw new CastcleException('USER_ID_IS_EXIST');

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

  async getReferral(
    { maxResults, userFields, ...query }: PaginationQuery,
    targetUser: User,
    requestedBy: User,
    refereeBy: boolean,
  ) {
    if (!targetUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const accounts = await this.repository.findAccounts(
      {
        _id: !refereeBy ? (targetUser.ownerAccount as any) : undefined,
        referredBy: refereeBy ? (targetUser.ownerAccount as any) : undefined,
        ...query,
      },
      {
        limit: maxResults,
      },
    );

    const accountId = accounts.map((account) => account._id);

    const accountsCount = refereeBy
      ? await this.repository.countAccount({
          referredBy: targetUser.ownerAccount as any,
          ...query,
        })
      : 0;

    const userResponses = await this.repository.getPublicUsers({
      requestedBy: requestedBy?._id,
      filter: { accountId: accountId, type: UserType.PEOPLE },
      expansionFields: userFields,
    });

    return ResponseDto.ok({
      payload: refereeBy ? userResponses : userResponses[0],
      meta: refereeBy
        ? Meta.fromDocuments(userResponses as any, accountsCount)
        : undefined,
    });
  }

  updateAppealUser = async (user: User, status: ReportingStatus) => {
    if (user.visibility !== EntityVisibility.Illegal)
      throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const reporting = await this.repository.findReporting({
      payloadId: user._id,
      user: user._id,
    });

    if (!reporting) return;

    if (!user?.reportedStatus)
      throw new CastcleException('REPORTING_STATUS_NOT_FOUND');

    if (user?.reportedStatus !== ReportingStatus.ILLEGAL)
      throw new CastcleException('REPORTING_APPEAL_IS_EXISTS');

    await this.repository.updateReportings(
      {
        user: user._id,
      },
      {
        $set: { status },
      },
    );

    user.reportedStatus = status;
    await user.save();

    if (status === ReportingStatus.NOT_APPEAL) return;

    await this.reportingQueue.add(
      {
        subject: `${ReportingAction.APPEAL} user : (OID : ${user._id})`,
        content: this.mailerService.generateHTMLReport(
          user.toPublicResponse(),
          {
            action: ReportingAction.APPEAL,
            actionBy: reporting.actionBy,
            message: reporting.message,
            reportedBy: user.displayName,
            subject: reporting.subject,
            type: ReportingType.USER,
            user: {
              id: user.id,
              castcleId: user.displayId,
              displayName: user.displayName,
            },
          },
        ),
      },
      {
        removeOnComplete: true,
      },
    );
  };

  async createPageAndSyncSocial(user: User, socialPageDto: SyncSocialDtoV2) {
    this.logger.log(`Start create sync social.`);
    this.logger.log(JSON.stringify(socialPageDto));

    let castcleId = '';
    const socialPage = new SocialPageDto();
    if (socialPageDto.userName && socialPageDto.displayName) {
      castcleId = socialPageDto.userName;
      socialPage.displayName = socialPageDto.displayName;
    } else if (socialPageDto.userName) {
      castcleId = socialPageDto.userName;
      socialPage.displayName = socialPageDto.userName;
    } else if (socialPageDto.displayName) {
      castcleId = socialPageDto.displayName;
      socialPage.displayName = socialPageDto.displayName;
    } else {
      const genId = getSocialPrefix(
        socialPageDto.socialId,
        socialPageDto.provider,
      );
      socialPage.displayName = castcleId = genId;
    }

    socialPage.castcleId = await this.repository.suggestCastcleId(
      `@${castcleId}`,
    );

    if (socialPageDto.avatar) {
      this.logger.log(`download avatar from ${socialPageDto.avatar}`);
      const imgAvatar = await this.download.getImageFromUrl(
        socialPageDto.avatar,
      );

      this.logger.log('upload avatar to s3');
      const avatar = await Image.upload(imgAvatar, {
        filename: `page-avatar-${socialPage.castcleId}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `page_${socialPage.castcleId}`,
      });

      socialPage.avatar = avatar.image;
      this.logger.log('Upload avatar');
    }

    if (socialPageDto.cover) {
      this.logger.log(`download avatar from ${socialPageDto.cover}`);
      const imgCover = await this.download.getImageFromUrl(socialPageDto.cover);

      this.logger.log('upload cover to s3');
      const cover = await Image.upload(imgCover, {
        filename: `page-cover-${socialPage.castcleId}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `page_${socialPage.castcleId}`,
      });
      socialPage.cover = cover.image;
      this.logger.log('Suggest Cover');
    }

    socialPage.overview = socialPageDto.overview;
    if (socialPageDto.link) {
      socialPage.links = { [socialPageDto.provider]: socialPageDto.link };
    }

    this.logger.log('Create new page');
    const page = await this.repository.createUser({
      ownerAccount: user.ownerAccount,
      type: UserType.PAGE,
      displayId: socialPage.castcleId,
      displayName: socialPage.displayName,
      profile: {
        overview: socialPage.overview,
        images: {
          avatar: socialPage.avatar,
          cover: socialPage.cover,
        },
        socials: {
          facebook: socialPage.links?.facebook,
          twitter: socialPage.links?.twitter,
          youtube: socialPage.links?.youtube,
          medium: socialPage.links?.medium,
        },
      },
    });

    this.logger.log('Create sync social');
    await this.socialSyncService.sync(page, {
      socialId: socialPageDto.socialId,
      provider: socialPageDto.provider,
      userName: socialPageDto.userName,
      displayName: socialPageDto.displayName,
      avatar: socialPageDto.avatar,
      active: (socialPageDto.active ??= true),
      autoPost: (socialPageDto.autoPost ??= true),
      authToken: socialPageDto.authToken,
    });

    this.logger.log(`get page data.`);

    const pageResponse = await this.getPublicUser(user, page.id);

    return { ...pageResponse, socialSyncs: true };
  }

  async updateUser(
    user: User,
    { images, links, contact, ...updateUserDto }: UpdateModelUserDto,
  ) {
    if (!user.profile) user.profile = {};
    if (updateUserDto.castcleId && updateUserDto.castcleId !== user.displayId) {
      user.displayIdUpdatedAt = new Date();
      user.displayId = updateUserDto.castcleId;
    }
    if (updateUserDto.displayName) user.displayName = updateUserDto.displayName;

    if (
      updateUserDto.overview !== undefined &&
      updateUserDto.overview !== null
    ) {
      user.profile.overview = updateUserDto.overview;
    }

    if (updateUserDto.dob) user.profile.birthdate = new Date(updateUserDto.dob);

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
    if (!user.contact) user.contact = {};
    if (contact?.countryCode) user.contact.countryCode = contact?.countryCode;
    if (contact?.email) user.contact.email = contact?.email;
    if (contact?.phone) user.contact.phone = contact?.phone;
    user.set(updateUserDto);
    user.markModified('profile');
    user.markModified('contact');
    console.debug('saving dto', updateUserDto);
    console.debug('saving website', user.profile.websites);
    console.debug('saving user', user);

    await this.userQueue.add(
      {
        id: user._id,
        action: CastcleQueueAction.UpdateProfile,
      },
      {
        removeOnComplete: true,
      },
    );

    return user.save();
  }
}
