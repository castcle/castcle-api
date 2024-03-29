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
  CastcleBullModule,
  CastcleMongooseModule,
  Environment,
} from '@castcle-api/environments';
import { CreatedUser, TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import {
  AdsService,
  AnalyticService,
  AuthenticationServiceV2,
  DataService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  RankerService,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
  UserServiceV2,
} from '../database.module';
import { EntityVisibility, PaginationQuery, QRCodeImageSize } from '../dtos';
import {
  KeywordType,
  MetadataType,
  QueueName,
  ReportingStatus,
  ReportingSubject,
  SocialProvider,
  UserType,
} from '../models';
import { Repository } from '../repositories';
import { Account, Metadata, User } from '../schemas';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';

describe('UserServiceV2', () => {
  let moduleRef: TestingModule;
  let dataService: DataService;
  let mocksUsers: CreatedUser[];
  let repository: Repository;
  let suggestServiceV2: SuggestionServiceV2;
  let userServiceV2: UserServiceV2;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CacheModule.register(),
        CastcleBullModule,
        CastcleMongooseModule,
        HttpModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AdsService,
        AnalyticService,
        AuthenticationServiceV2,
        CommentService,
        ContentService,
        DataService,
        Downloader,
        HashtagService,
        NotificationServiceV2,
        RankerService,
        Repository,
        SuggestionServiceV2,
        SocialSyncServiceV2,
        TAccountService,
        UserServiceV2,
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        {
          provide: Mailer,
          useValue: {
            sendRegistrationEmail: jest.fn(),
            generateHTMLReport: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.VERIFY_EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    });

    dataService = moduleRef.get(DataService);
    suggestServiceV2 = moduleRef.get(SuggestionServiceV2);
    userServiceV2 = moduleRef.get(UserServiceV2);
    dataService = moduleRef.get(DataService);
    repository = moduleRef.get(Repository);
    suggestServiceV2 = moduleRef.get(SuggestionServiceV2);

    const metadataModel =
      moduleRef.getModel<Metadata<ReportingSubject>>('Metadata');

    await new metadataModel({
      type: MetadataType.REPORTING_SUBJECT,
      payload: {
        slug: 'spam',
        name: 'Spam',
        order: 1,
      },
    }).save();

    jest.spyOn(dataService, 'getFollowingSuggestions').mockRestore();
  });

  afterAll(() => {
    return moduleRef.close();
  });

  describe('#getUserRelationships', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await userServiceV2.blockUser(user2, String(user1._id));
      const blocking = await userServiceV2.getUserRelationships(user1, true);

      expect(blocking).toHaveLength(1);
      expect(blocking).toContainEqual(user2._id);
    });
  });

  describe('#blockUser', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;

      await userServiceV2.blockUser(user1, String(user2._id));
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await expect(userServiceV2.blockUser(user1, 'undefined')).rejects.toThrow(
        new CastcleException('USER_OR_PAGE_NOT_FOUND'),
      );
    });

    it('should return blocked lookup user', async () => {
      const relationship = await userServiceV2.getBlockedLookup(
        user1,
        new PaginationQuery(),
      );

      expect(relationship).not.toBeNull();
      expect(relationship.items.length).toBeGreaterThan(0);
    });

    it('should block user and create blocking relationship', async () => {
      const [blockedUser, blockerUser] = await Promise.all([
        repository
          .findRelationships({ userId: [user2._id], followedUser: user1._id })
          .exec(),
        repository
          .findRelationships({ userId: [user1._id], followedUser: user2._id })
          .exec(),
      ]);

      expect(blockerUser).not.toBeNull();
      expect(blockedUser).not.toBeNull();

      expect(blockedUser[0].blocked).toBeTruthy();
      expect(blockedUser[0].following).toBeFalsy();

      expect(blockerUser[0].blocking).toBeTruthy();
      expect(blockerUser[0].following).toBeFalsy();
    });

    it('should unblock user and remove blocking relationship', async () => {
      await userServiceV2.unblockUser(user1, String(user2._id));
      const [blockedUser, blockerUser] = await Promise.all([
        repository
          .findRelationships({ userId: [user2._id], followedUser: user1._id })
          .exec(),
        repository
          .findRelationships({ userId: [user1._id], followedUser: user2._id })
          .exec(),
      ]);

      expect(blockerUser).toHaveLength(0);
      expect(blockedUser).toHaveLength(0);
    });
  });

  describe('#follow', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });
    it('should return empty user if user have not followers', async () => {
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followers.users).toHaveLength(0);
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to follow is not found', async () => {
      await expect(
        userServiceV2.followUser(user1, 'undefined', user1.ownerAccount),
      ).rejects.toThrow(new CastcleException('USER_OR_PAGE_NOT_FOUND'));
    });

    it('should follow user and create follow relationship', async () => {
      await userServiceV2.followUser(
        user1,
        String(user2._id),
        user1.ownerAccount,
      );
      const followRelation = await repository
        .findRelationships({ userId: [user1._id], followedUser: user2._id })
        .exec();

      expect(followRelation).not.toBeNull();
      expect(followRelation[0].following).toBeTruthy();
    });

    it('should return user1 is following user2 after follow', async () => {
      const followingUser = await userServiceV2.getFollowing(
        user1.ownerAccount,
        user1,
        {
          hasRelationshipExpansion: true,
        },
      );
      expect(followingUser).not.toBeNull();
      expect((followingUser.users[0] as any).id).toEqual(user2._id);
    });

    it('should return followers user after create follow relationship', async () => {
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );

      expect(followers.users.length).toBeGreaterThan(0);
    });

    it('should remove relationship after unfollow user', async () => {
      await userServiceV2.unfollowUser(user1, String(user2._id));
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followers.users).toHaveLength(0);
    });

    it('should return empty after user1 unfollow user2', async () => {
      const followingUser = await userServiceV2.getFollowing(
        user1.ownerAccount,
        user1,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followingUser.users).toHaveLength(0);
    });
  });

  describe('#pages', () => {
    it('should return undefined when user have no page', async () => {
      const result = await userServiceV2.getMyPages(mocksUsers[0].user);
      expect(result[0]).toBeUndefined();
    });

    it('should return page when user create page', async () => {
      const page = await userServiceV2.createPage(mocksUsers[0].user, {
        castcleId: 'testNewPage',
        displayName: 'testNewPage',
      });

      expect(page).toBeDefined();
    });

    it('should return new castcleId is duplicate', async () => {
      const respPage = await userServiceV2.createPage(mocksUsers[0].user, {
        castcleId: '@testNewPage',
        displayName: 'testNewPage',
      });
      expect(respPage.castcleId).toEqual('@testnewpage1');
    });

    it('should return page of user when created', async () => {
      const pages = await userServiceV2.getMyPages(mocksUsers[0].user);
      expect(pages[0]).toBeDefined();
    });

    it('should return page when user create page with syncsocial', async () => {
      const page = await userServiceV2.createPageAndSyncSocial(
        mocksUsers[0].user,
        {
          provider: SocialProvider.Twitter,
          socialId: 'twitterId',
          userName: 'evekung',
          displayName: 'evejung',
        } as any,
      );

      expect(page.castcleId).toEqual('@evekung');
    });

    it('should add postfix if castcleid exist', async () => {
      const page = await userServiceV2.createPageAndSyncSocial(
        mocksUsers[0].user,
        {
          provider: SocialProvider.Twitter,
          socialId: 'twitterId',
          userName: 'evekung',
          displayName: 'evejung',
        } as any,
      );

      expect(page.castcleId).toEqual('@evekung1');
    });
  });

  describe('getUserByKeyword', () => {
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(10);
    });
    it('should get user by keyword', async () => {
      const getUserByKeyword = await userServiceV2.getUserByKeyword(
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: mocksUsers[0].user.displayId,
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getUserByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const getUserByKeyword = await userServiceV2.getUserByKeyword(
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'empty',
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getUserByKeyword.payload).toHaveLength(0);
    });
  });

  describe('createQRCode', () => {
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(1);
    });
    it('should get qr code size thumbnail', async () => {
      const createQRCode = await userServiceV2.createQRCode(
        'castcleChain',
        QRCodeImageSize.Thumbnail,
        mocksUsers[0].user._id,
      );

      expect(createQRCode.payload).toMatch(/base64/g);
    });
  });

  describe('#suggest', () => {
    let user: User;

    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(10);
      jest.spyOn(dataService, 'getFollowingSuggestions').mockResolvedValue([
        {
          userId: mocksUsers[0].user._id,
          engagements: 200,
        },
        {
          userId: mocksUsers[1].user._id,
          engagements: 50,
        },
      ]);

      user = mocksUsers[2].user;
    });

    it('should return suggest user by datascience and cache to redis', async () => {
      const usersFiltered = await (
        suggestServiceV2 as any
      ).querySuggestByDataScience(
        user.ownerAccount._id,
        mocksUsers[2].accessToken,
      );

      expect(usersFiltered).toHaveLength(2);
    });

    it('should return next value of untilId', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        mocksUsers[2].accessToken,
        {
          untilId: mocksUsers[0].user.id,
          hasRelationshipExpansion: false,
        },
      );
      expect(usersFiltered).toHaveLength(1);
    });

    it('should return previous value of sinceId', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        mocksUsers[2].accessToken,
        {
          sinceId: mocksUsers[1].user.id,
          hasRelationshipExpansion: false,
        },
      );

      expect(usersFiltered).toHaveLength(1);
    });

    it('should return empty array if userId not exist in suggest user', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        mocksUsers[2].accessToken,
        { untilId: 'undefined', hasRelationshipExpansion: false },
      );
      expect(usersFiltered).toHaveLength(0);
    });
  });

  describe('updatePDPA', () => {
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(1);
      Environment.PDPA_ACCEPT_DATES = ['20200701'];
    });

    it('should get user data pdpa in response', async () => {
      const userResponse = await userServiceV2.updatePDPA(
        '20200701',
        mocksUsers[0].account,
      );

      expect(userResponse).toBeUndefined();
    });
  });

  describe('getReferral', () => {
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(1);
      mocksUsers.push(
        await moduleRef.createUser({ referrer: mocksUsers[0].account._id }),
      );
    });

    it('should get user referee', async () => {
      const referee = await userServiceV2.getReferral(
        {
          maxResults: 10,
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
        mocksUsers[1].user,
        true,
      );

      expect(referee.payload).toHaveLength(1);
    });

    it('should get user referrer', async () => {
      const referrer = await userServiceV2.getReferral(
        {
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
        mocksUsers[1].user,
        false,
      );

      expect(referrer.payload).not.toBeNull();
    });
  });
  describe('updateEmail', () => {
    let mockUser: User;
    let mockAccount: Account;

    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      mockAccount = await repository.createAccount({
        preferences: {
          languages: ['th', 'th'],
        },
      });
      mockAccount.isGuest = false;
      await mockAccount.save();
      mockUser = await repository.createUser({
        ownerAccount: mockAccount._id,
        displayId: `mock-update-email`,
        displayName: `mock`,
        type: UserType.PEOPLE,
      });
    });
    it('should be update email that account email is exists.', async () => {
      await expect(
        userServiceV2.updateEmail(
          mocksUsers[0].account,
          mocksUsers[0].user,
          'mock@mock.com',
          '0.0.0.0',
        ),
      ).rejects.toThrow(new CastcleException('EMAIL_CAN_NOT_CHANGE'));
    });

    it('should be update email that account email is duplicate.', async () => {
      await expect(
        userServiceV2.updateEmail(
          mockAccount,
          mockUser,
          mocksUsers[1].account.email,
          '0.0.0.0',
        ),
      ).rejects.toThrow(new CastcleException('DUPLICATE_EMAIL'));
    });
    it('should be update email that account without email and not duplicate.', async () => {
      const userResponse = await userServiceV2.updateEmail(
        mockAccount,
        mockUser,
        'mock-update-email1@mock.com',
        '0.0.0.0',
      );

      expect(userResponse).toBeDefined();
    });
  });

  describe('reportUser', () => {
    let reportedUser: User;
    let reportedByUser: User;
    let mocksUsers: CreatedUser[];
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      reportedUser = mocksUsers[1].user;
      reportedByUser = mocksUsers[0].user;
    });

    it('should error report user is reporting subject not found.', async () => {
      await expect(
        userServiceV2.reportUser(reportedByUser, {
          targetCastcleId: reportedUser._id,
          message: 'report user',
          subject: 'test',
        }),
      ).rejects.toThrowError(
        new CastcleException('REPORTING_SUBJECT_NOT_FOUND'),
      );
    });

    it('should create report user.', async () => {
      await userServiceV2.reportUser(reportedByUser, {
        targetCastcleId: reportedUser._id,
        message: 'report user',
        subject: 'spam',
      });

      const reporting = await repository.findReporting({
        by: reportedByUser._id,
        payloadId: reportedUser._id,
      });

      expect(reporting.by).toEqual(reportedByUser._id);
      expect(reporting.user).toEqual(reportedUser._id);
      expect(reporting.message).toEqual('report user');
      expect(reporting.subject).toEqual('spam');
    });

    it('should error report user is exists.', async () => {
      await expect(
        userServiceV2.reportUser(reportedByUser, {
          targetCastcleId: reportedUser._id,
          message: 'report user',
          subject: 'spam',
        }),
      ).rejects.toThrowError(new CastcleException('REPORTING_IS_EXIST'));
    });
  });

  describe('updateAppealUser', () => {
    let reportedUser: User;
    let reportedByUser: User;
    let mocksUsers: CreatedUser[];
    beforeAll(async () => {
      mocksUsers = await moduleRef.createUsers(2);
      reportedUser = mocksUsers[1].user;
      reportedByUser = mocksUsers[0].user;

      reportedUser = await repository.findUser({ _id: reportedUser.id });
      await userServiceV2.reportUser(reportedByUser, {
        targetCastcleId: reportedUser._id,
        message: 'appeal user',
        subject: 'spam',
      });
      reportedUser = await reportedUser
        .set('visibility', EntityVisibility.Illegal)
        .save();
    });

    it('should update reportedStatus content and reporting status equal "appeal"', async () => {
      reportedUser.reportedStatus = ReportingStatus.ILLEGAL;
      reportedUser.reportedSubject = 'test';
      reportedUser = await reportedUser.save();

      await userServiceV2.updateAppealUser(
        reportedUser,
        ReportingStatus.APPEAL,
      );

      const user = await repository.findUser({
        _id: reportedUser._id,
        visibility: EntityVisibility.Illegal,
      });

      const reporting = await repository.findReporting({
        payloadId: reportedUser._id,
      });

      expect(user.id).toEqual(reportedUser.id);
      expect(user.reportedStatus).not.toBeUndefined();
      expect(user.reportedStatus).toEqual(ReportingStatus.APPEAL);

      expect(reporting.by).toEqual(reportedByUser._id);
      expect(reporting.status).toEqual(ReportingStatus.APPEAL);
      expect(reporting.user).toEqual(reportedUser._id);
    });

    it('should update reportedStatus content and reporting status equal "not-appeal"', async () => {
      reportedUser.reportedStatus = ReportingStatus.ILLEGAL;
      reportedUser.reportedSubject = 'test';
      reportedUser.markModified('reportedStatus');
      reportedUser = await reportedUser.save();

      await userServiceV2.updateAppealUser(
        reportedUser,
        ReportingStatus.NOT_APPEAL,
      );

      const user = await repository.findUser({
        _id: reportedUser._id,
        visibility: EntityVisibility.Illegal,
      });

      const reporting = await repository.findReporting({
        payloadId: reportedUser._id,
      });

      expect(user.id).toEqual(reportedUser.id);
      expect(user.reportedStatus).not.toBeUndefined();
      expect(user.reportedStatus).toEqual(ReportingStatus.NOT_APPEAL);

      expect(reporting.by).toEqual(reportedByUser._id);
      expect(reporting.status).toEqual(ReportingStatus.NOT_APPEAL);
      expect(reporting.user).toEqual(reportedUser._id);
    });
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
    expect(userServiceV2).toBeDefined();
  });
});
