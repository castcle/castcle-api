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
import { NotificationServiceV2 } from './notification.service.v2';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AnalyticService,
  ContentServiceV2,
  DataService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserServiceV2,
} from '../database.module';
import { ContentType, NotificationType, ShortPayload } from '../dtos';
import {
  generateMockUsers,
  MockUserDetail,
  mockContents,
  mockDeposit,
} from '../mocks';
import {
  ContentFarmingStatus,
  KeywordType,
  QueueName,
  SearchType,
  WalletType,
} from '../models';
import { Content, ContentFarming } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';
import { TAccountService } from './taccount.service';
import { Repository } from '../repositories';
import { HttpModule } from '@nestjs/axios';
import { EngagementType } from '../models';
import { Mailer } from '@castcle-api/utils/clients';
import { CampaignService } from './campaign.service';

describe('ContentServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: ContentServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let taccountService: TAccountService;
  let content: Content;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        ContentServiceV2,
        ContentService,
        HashtagService,
        UserService,
        NotificationService,
        NotificationServiceV2,
        TAccountService,
        Repository,
        DataService,
        UserServiceV2,
        { provide: AnalyticService, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: Mailer, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    authService = app.get(AuthenticationService);
    contentService = app.get(ContentService);
    service = app.get(ContentServiceV2);
    userService = app.get(UserService);
    taccountService = app.get(TAccountService);

    mocksUsers = await generateMockUsers(5, 0, {
      userService: userService,
      accountService: authService,
    });

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'content v2' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });
  });

  describe('#toContentsResponses()', () => {
    it('should get casts is exists.', async () => {
      const [bundleContents] = await (
        service as any
      ).repository.aggregationContent({
        viewer: mocksUsers[2].user,
        _id: content._id,
        maxResults: 25,
      });
      const contentResp = await (service as any).toContentsResponses(
        bundleContents,
      );

      expect(contentResp.payload).toHaveLength(1);
    });
  });
  describe('#toContentResponse()', () => {
    it('should get cast is exists.', async () => {
      const [bundleContents] = await (
        service as any
      ).repository.aggregationContent({
        viewer: mocksUsers[2].user,
        _id: content._id,
        maxResults: 25,
      });
      const contentResp = await (service as any).toContentResponse(
        bundleContents,
      );

      expect(contentResp.payload.id).toEqual(String(content._id));
      expect(contentResp.payload.message).toEqual(
        (content.payload as ShortPayload).message,
      );
    });
  });

  describe('#likeCast()', () => {
    it('should create like cast.', async () => {
      await service.likeCast(
        content._id,
        mocksUsers[1].user,
        mocksUsers[1].account,
      );
      const engagement = await (service as any).repository.findEngagement({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
        type: EngagementType.Like,
      });
      expect(engagement).toBeTruthy();
      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.targetRef.oid)).toEqual(String(content._id));
      expect(engagement.type).toEqual(NotificationType.Like);
    });
  });

  describe('#unlikeCast()', () => {
    it('should delete unlike cast.', async () => {
      await service.unlikeCast(content._id, mocksUsers[1].user);
      const engagement = await (service as any).repository.findEngagement({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
        type: EngagementType.Like,
      });
      expect(engagement).toBeNull();
    });
  });
  describe('#recast()', () => {
    it('should create recast.', async () => {
      const { recastContent, engagement } = await service.recast(
        content._id,
        mocksUsers[1].user,
        mocksUsers[1].account,
      );

      expect(recastContent).toBeTruthy();
      expect(engagement).toBeTruthy();

      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.itemId)).toEqual(String(recastContent._id));
      expect(engagement.type).toEqual(NotificationType.Recast);
    });
  });

  describe('#undoRecast()', () => {
    it('should delete cast.', async () => {
      const recast = await (service as any).repository.findContent({
        author: mocksUsers[1].user._id,
        originalPost: content._id,
      });

      await service.undoRecast(content._id, mocksUsers[1].user);
      const engagement = await (service as any).repository.findEngagement({
        user: mocksUsers[1].user._id,
        itemId: recast._id,
        type: EngagementType.Recast,
      });
      expect(engagement).toBeNull();
    });
  });

  describe('#quoteCast()', () => {
    it('should create quote cast.', async () => {
      const { quoteContent, engagement } = await service.quoteCast(
        content._id,
        'quote cast',
        mocksUsers[1].user,
        mocksUsers[1].account,
      );

      expect(quoteContent).toBeTruthy();
      expect(engagement).toBeTruthy();

      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.itemId)).toEqual(String(quoteContent._id));
      expect(engagement.type).toEqual(NotificationType.Quote);
    });
  });
  describe('Farming', () => {
    let mockFarmingUsers: MockUserDetail[];
    let testContents: Content[] = [];
    const initialBalance = 1000;
    const expectedBalances = [
      950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250,
      200, 150, 100, 50, 0,
    ];
    beforeAll(async () => {
      mockFarmingUsers = await generateMockUsers(3, 1, {
        accountService: authService,
        userService,
      });
      //user 0 create a content
      const user = mockFarmingUsers[0].user;
      testContents = await mockContents(user, (service as any).contentModel, {
        amount: 21,
        type: ContentType.Short,
      });

      //top up user 1 for 1000 CAST
      await mockDeposit(
        mockFarmingUsers[1].user,
        initialBalance,
        taccountService._transactionModel,
      );
      const balance = await taccountService.getAccountBalance(
        mockFarmingUsers[1].user.id,
        WalletType.PERSONAL,
      );
      expect(balance).toEqual(initialBalance);

      //mocksUsers[1]
    });
    describe('#createContentFarming', () => {
      let contentFarming: ContentFarming;
      beforeAll(async () => {
        expect(await taccountService._transactionModel.count()).toEqual(1);
        contentFarming = await service.createContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].user.id,
        );
        expect(await taccountService._transactionModel.count()).toEqual(2);
      });
      it('should be able to create content farming instance if have balance > 5% total', async () => {
        expect(String(contentFarming.content)).toEqual(testContents[0].id);
        expect(String(contentFarming.user)).toEqual(
          mockFarmingUsers[1].user.id,
        );
        expect(contentFarming.status).toEqual(ContentFarmingStatus.Farming);
      });
      it('should have 95% balance of %initialBalance', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(currentBalance).toEqual(0.95 * initialBalance);
      });
      it('should spend 5% each until it can\t spend it', async () => {
        for (let i = 1; i < testContents.length - 1; i++) {
          await service.createContentFarming(
            testContents[i].id,
            mockFarmingUsers[1].user.id,
          );
          const currentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].user.id,
            WalletType.PERSONAL,
          );
          expect(currentBalance).toEqual(expectedBalances[i]);
        }
        //do this time expected error
      });
    });

    describe('#unfarm', () => {
      it('should get balance back once unfarm and the farm status of that should be farmed', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        const unfarmResult = await service.unfarm(
          testContents[0].id,
          mockFarmingUsers[1].user.id,
        );
        const afterBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(afterBalance).toEqual(unfarmResult.farmAmount + currentBalance);
        const recentContentFarming = await service.getContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].user.id,
        );
        expect(recentContentFarming.status).toEqual(
          ContentFarmingStatus.Farmed,
        );
      });
    });
    describe('#updateContentFarming', () => {
      it('should change status from farmed to farming', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        const recentContentFarming = await service.getContentFarming(
          testContents[0].id,
          mockFarmingUsers[1].user.id,
        );
        const updateFarmingResult = await service.updateContentFarming(
          recentContentFarming,
        );
        expect(updateFarmingResult.status).toEqual(
          ContentFarmingStatus.Farming,
        );
        const recentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(currentBalance).not.toEqual(recentBalance);
        expect(recentBalance).toEqual(
          currentBalance - updateFarmingResult.farmAmount,
        );
      });
    });

    describe('#expire', () => {
      it('should return all tokens to users and all status should be farmed', async () => {
        const currentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(currentBalance).toEqual(0);
        let start = 0;
        for (let i = 0; i < testContents.length - 1; i++) {
          const unfarmResult = await service.expireFarm(
            testContents[i].id,
            mockFarmingUsers[1].user.id,
          );
          start += unfarmResult.farmAmount;
          const recentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].user.id,
            WalletType.PERSONAL,
          );
          expect(recentBalance).toEqual(currentBalance + start);
        }
        const latestBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(latestBalance).toEqual(initialBalance);
      });
    });

    describe('#farm', () => {
      let finalTestContents: Content[] = [];
      beforeAll(async () => {
        const user = mockFarmingUsers[0].user;
        finalTestContents = await mockContents(
          user,
          (service as any).contentModel,
          { amount: 21, type: ContentType.Short },
        );
      });
      it('should create new contentFarming if not yet create', async () => {
        for (let i = 0; i < finalTestContents.length - 1; i++) {
          await service.farm(
            finalTestContents[i].id,
            mockFarmingUsers[1].user.id,
          );
          const currentBalance = await taccountService.getAccountBalance(
            mockFarmingUsers[1].user.id,
            WalletType.PERSONAL,
          );
          expect(currentBalance).toEqual(expectedBalances[i]);
        }
        const recentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );
        expect(recentBalance).toEqual(0);
      });
    });
    describe('#expire', () => {
      it('should return all token after wait for 2 seconds(default is 1 secs)', async () => {
        await new Promise((r) => setTimeout(r, 2000));
        await service.expireAllFarmedToken();
        const recentBalance = await taccountService.getAccountBalance(
          mockFarmingUsers[1].user.id,
          WalletType.PERSONAL,
        );

        expect(recentBalance).toEqual(initialBalance);
      });
    });
  });

  describe('#getEngagementCast()', () => {
    it('should create liking user on cast.', async () => {
      await service.likeCast(
        content._id,
        mocksUsers[1].user,
        mocksUsers[1].account,
      );
      await service.likeCast(
        content._id,
        mocksUsers[2].user,
        mocksUsers[2].account,
      );
      await service.likeCast(
        content._id,
        mocksUsers[3].user,
        mocksUsers[3].account,
      );
      const likingResponse = await service.getEngagementCast(
        content._id,
        mocksUsers[4].account,
        {
          maxResults: 25,
          hasRelationshipExpansion: true,
        },
        EngagementType.Like,
        mocksUsers[4].user,
      );
      expect(likingResponse).toBeTruthy();
      expect(likingResponse.payload).toHaveLength(3);
    });
    it('should create recast user on cast.', async () => {
      await service.recast(
        content._id,
        mocksUsers[1].user,
        mocksUsers[1].account,
      );
      const recastResponse = await service.getEngagementCast(
        content._id,
        mocksUsers[4].account,
        {
          maxResults: 25,
          hasRelationshipExpansion: true,
        },
        EngagementType.Recast,
        mocksUsers[4].user,
      );
      expect(recastResponse.payload).toHaveLength(1);
      await recastResponse.payload.map((item) => {
        expect(item.id).toEqual(mocksUsers[1].user._id);
      });
    });
  });

  describe('#getQuoteByCast()', () => {
    it('should create quote cast user on cast.', async () => {
      const quotecastResponse = await service.getQuoteByCast(
        content._id,
        {
          maxResults: 25,
          hasRelationshipExpansion: true,
        },
        mocksUsers[4].user,
      );
      expect(quotecastResponse).toBeTruthy();
      expect(quotecastResponse.payload).toHaveLength(1);
    });
  });

  describe('#getRecastPipeline()', () => {
    it('should get recast user on cast.', async () => {
      const newRecast = await service.recast(
        content._id,
        mocksUsers[3].user,
        mocksUsers[3].account,
      );

      const recast = await service.getRecastPipeline(
        newRecast.recastContent._id,
        mocksUsers[3].user,
      );

      expect(recast.payload).toBeTruthy();
      expect(recast.payload.id).toEqual(newRecast.recastContent.id);
      expect(recast.payload.referencedCasts.id).toEqual(
        newRecast.recastContent.originalPost._id,
      );
    });
  });

  describe('#getQuoteCastPipeline()', () => {
    it('should get quote cast user on cast.', async () => {
      const newQuote = await service.quoteCast(
        content._id,
        'quote cast',
        mocksUsers[4].user,
        mocksUsers[4].account,
      );

      const recast = await service.getQuoteCastPipeline(
        newQuote.quoteContent._id,
        mocksUsers[3].user,
      );

      expect(recast.payload).toBeTruthy();
      expect(recast.payload.id).toEqual(newQuote.quoteContent.id);
      expect(recast.payload.referencedCasts.id).toEqual(
        newQuote.quoteContent.originalPost._id,
      );
    });
  });

  describe('#getContent()', () => {
    it('should get cast is exists.', async () => {
      const contentResp = await service.getContent(
        content._id,
        mocksUsers[1].user,
        false,
      );

      expect(contentResp.payload.id).toEqual(String(content._id));
      expect(contentResp.payload.message).toEqual(
        (content.payload as ShortPayload).message,
      );
    });
  });

  describe('#getContents()', () => {
    it('should get cast is exists.', async () => {
      const contentResp = await service.getContents(
        { hasRelationshipExpansion: false },
        mocksUsers[1].user,
      );
      expect(contentResp.payload).toHaveLength(25);
    });
  });

  describe('#createContent()', () => {
    it('should create cast is exists.', async () => {
      const createContent = {
        castcleId: mocksUsers[3].user.displayId,
        type: ContentType.Short,
        payload: {
          message: 'Hello world!',
          photo: {
            contents: [],
          },
          link: [
            {
              type: 'other',
              url: 'https://castcle.com',
            },
          ],
        },
      };
      const contentResp = await service.createContent(
        createContent,
        mocksUsers[3].user,
      );

      expect(contentResp.payload.type).toEqual(ContentType.Short);
      expect(String(contentResp.payload.authorId)).toEqual(
        String(mocksUsers[3].user._id),
      );
      expect(contentResp.payload.message).toEqual(
        createContent.payload.message,
      );
    });
  });

  describe('#deleteContent()', () => {
    it('should delete cast is exists.', async () => {
      const createContent = {
        castcleId: mocksUsers[3].user.displayId,
        type: ContentType.Short,
        payload: {
          message: 'Hello world!',
          photo: {
            contents: [],
          },
          link: [
            {
              type: 'other',
              url: 'https://castcle.com',
            },
          ],
        },
      };
      const contentResp = await service.createContent(
        createContent,
        mocksUsers[3].user,
      );
      await service.likeCast(
        contentResp.payload.id,
        mocksUsers[3].user,
        mocksUsers[3].account,
      );
      await service.deleteContent(contentResp.payload.id, mocksUsers[3].user);

      const content = await (service as any).repository.findContent({
        _id: contentResp.payload.id,
      });

      expect(content).toBeNull();
    });
  });

  describe('#getParticipates()', () => {
    it('should get participates cast is exists.', async () => {
      await service.likeCast(
        content._id,
        mocksUsers[4].user,
        mocksUsers[4].account,
      );

      await service.recast(
        content._id,
        mocksUsers[4].user,
        mocksUsers[4].account,
      );

      await service.quoteCast(
        content._id,
        'test',
        mocksUsers[4].user,
        mocksUsers[4].account,
      );
      const participates = await service.getParticipates(
        content._id,
        mocksUsers[4].account,
      );

      expect(participates[0].user.id).toEqual(String(mocksUsers[4].user._id));
      expect(participates[0].participate.liked).toBeTruthy();
      expect(participates[0].participate.commented).toBeFalsy();
      expect(participates[0].participate.quoted).toBeTruthy();
      expect(participates[0].participate.recasted).toBeTruthy();
      expect(participates[0].participate.reported).toBeFalsy();
    });
  });

  describe('#getSearchRecent()', () => {
    it('should get cast is exists.', async () => {
      const getSearchRecent = await service.getSearchRecent(
        {
          keyword: {
            type: KeywordType.Word,
            input: 'Hello',
          },
          hasRelationshipExpansion: true,
          maxResults: 25,
        },
        mocksUsers[0].user,
      );

      expect(getSearchRecent.payload).toHaveLength(25);
    });

    it('should get cast is not exists.', async () => {
      const getSearchRecent = await service.getSearchRecent(
        {
          keyword: {
            type: KeywordType.Word,
            input: 'Hello',
          },
          contentType: SearchType.PHOTO,
          hasRelationshipExpansion: true,
          maxResults: 25,
        },
        mocksUsers[0].user,
      );

      expect(getSearchRecent.payload).toHaveLength(25);
    });
  });

  describe('#getSearchTrends()', () => {
    beforeAll(async () => {
      const contents = await (service as any).repository.findContents(
        {
          keyword: {
            type: KeywordType.Word,
            input: 'H',
          },
          maxResults: 1000,
          decayDays: 7,
          executeAuthor: [],
        },
        { projection: { _id: 1 } },
      );

      const contentsObj = {};

      contents.forEach((content) => {
        contentsObj[content._id] = Math.random();
      });

      jest
        .spyOn(service, 'sortContentsByScore')
        .mockResolvedValueOnce(contentsObj);
    });
    it('should get cast is exists.', async () => {
      const getSearchTrends = await service.getSearchTrends(
        {
          keyword: {
            type: KeywordType.Word,
            input: 'H',
          },
          hasRelationshipExpansion: true,
          maxResults: 25,
        },
        mocksUsers[0].user,
        mocksUsers[0].account,
        'testtesttesttesttesttesttesttesttesttest',
      );

      expect(getSearchTrends.payload).toHaveLength(25);
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
