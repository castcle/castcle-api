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
  AnalyticService,
  AuthenticationServiceV2,
  CampaignService,
  ContentServiceV2,
  ContentType,
  DataService,
  EntityVisibility,
  HashtagService,
  Metadata,
  MetadataType,
  MockUserDetail,
  MockUserService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  ReportingIllegal,
  ReportingStatus,
  ReportingSubject,
  ReportingType,
  Repository,
  TAccountService,
  UserServiceV2,
} from '@castcle-api/database';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { Token } from '@castcle-api/utils/commons';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { StaffRole } from '../models/authentication.enum';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { Staff } from '../schemas/staff.schema';
import { AuthenticationService } from './authentication.service';
import { ReportingService } from './reporting.service';

class StaffMockData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: string;
  accessToken?: string;
}
describe('ReportingService', () => {
  let authService: AuthenticationService;
  let contentService: ContentServiceV2;
  let generateUser: MockUserService;
  let mocksUsers: MockUserDetail[];
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let service: ReportingService;
  let staffData: StaffMockData;
  let userService: UserServiceV2;
  let repository: Repository;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    global.mongoUri = mongod.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri(), { retryWrites: false }),
        BackOfficeMongooseForFeatures,
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      providers: [
        AuthenticationService,
        AuthenticationServiceV2,
        ContentServiceV2,
        HashtagService,
        MockUserService,
        NotificationServiceV2,
        ReportingService,
        Repository,
        UserServiceV2,
        { provide: AnalyticService, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: DataService, useValue: {} },
        { provide: TAccountService, useValue: {} },
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },

        {
          provide: getQueueToken(QueueName.CONTENT),
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
          provide: Mailer,
          useValue: {
            sendPasswordToStaff: jest.fn(),
            generateHTMLReport: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<ReportingService>(ReportingService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
    contentService = moduleRef.get<ContentServiceV2>(ContentServiceV2);
    generateUser = moduleRef.get<MockUserService>(MockUserService);
    userService = moduleRef.get<UserServiceV2>(UserServiceV2);
    repository = moduleRef.get<Repository>(Repository);

    const metadataModel = moduleRef.get<Model<Metadata<ReportingSubject>>>(
      getModelToken('Metadata'),
    );

    await new metadataModel({
      type: MetadataType.REPORTING_SUBJECT,
      payload: {
        slug: 'spam',
        name: 'Spam',
        order: 1,
      },
    }).save();

    const staff = await authService.createStaffFromEmail({
      email: 'test@gmail.com',
      firstName: 'test',
      lastName: 'test',
      role: StaffRole.ADMINISTRATOR,
    });

    const { accessToken } = await authService.getStaffFromEmail(
      staff.email,
      staff.password,
    );

    const staffPayload = Token.decodeToken(accessToken);

    staffData = { ...staffPayload, accessToken };

    mocksUsers = await generateUser.generateMockUsers(7);

    const response = await contentService.createContent(
      {
        payload: { message: 'content v2' },
        type: ContentType.Short,
        castcleId: mocksUsers[5].user.displayId,
      },
      mocksUsers[5].user,
    );

    await contentService.reportContent(mocksUsers[1].user, {
      targetContentId: response.payload.id,
      subject: 'spam',
    });

    await userService.reportUser(mocksUsers[1].user, {
      targetCastcleId: mocksUsers[2].user.id,
      subject: 'spam',
    });
  });

  afterAll(async () => {
    await Promise.all([moduleRef.close(), mongod.stop()]);
  });

  describe('getReporting', () => {
    it('should get reporting filter type content', async () => {
      const reportings = await service.getReporting({ type: ['content'] });

      expect(reportings.payload).toBeDefined();

      expect(reportings.payload[0].user.id).toEqual(mocksUsers[5].user.id);
      expect(reportings.payload[0].reportBy[0].user.id).toEqual(
        mocksUsers[1].user.id,
      );
    });

    it('should get reporting filter type user', async () => {
      const reportings = await service.getReporting({ type: ['user'] });

      expect(reportings.payload).toBeDefined();

      expect(reportings.payload[0].user.id).toEqual(mocksUsers[2].user.id);
      expect(reportings.payload[0].reportBy[0].user.id).toEqual(
        mocksUsers[1].user.id,
      );
    });
  });

  describe('updateNotIllegal', () => {
    beforeAll(async () => {
      await mocksUsers[4].user.follow(mocksUsers[5].user);
      await mocksUsers[5].user.follow(mocksUsers[4].user);
      await userService.reportUser(mocksUsers[4].user, {
        targetCastcleId: mocksUsers[5].user.id,
        subject: 'spam',
      });
    });
    it('should update reporting content not illegal', async () => {
      const reporting = await repository.findReporting({
        user: mocksUsers[5].user._id,
        type: ReportingType.CONTENT,
      });

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.CONTENT,
          subjectByAdmin: 'testsubjectByAdmin',
        },
        staffData as Staff,
        ReportingIllegal.ILLEGAL,
      );

      const user = await repository.findUser({
        _id: mocksUsers[5].user._id,
      });

      expect(user.casts).toEqual(0);

      const content = await repository.findContent({
        _id: reporting.payload._id,
        visibility: [EntityVisibility.Illegal, EntityVisibility.Publish],
      });

      expect(content.visibility).toEqual(EntityVisibility.Illegal);

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.CONTENT,
          subjectByAdmin: 'testsubjectByAdmin',
        },
        staffData as Staff,
        ReportingIllegal.NOT_ILLEGAL,
      );

      const userEnded = await repository.findUser({
        _id: mocksUsers[5].user._id,
      });

      expect(userEnded.casts).toEqual(1);

      const reportingAfter = await repository.findReporting({
        _id: reporting.id,
        type: ReportingType.CONTENT,
      });

      const contentAfter = await repository.findContent({
        _id: reporting.payload._id,
      });

      expect(contentAfter.visibility).toEqual(EntityVisibility.Publish);
      expect(reportingAfter.status).toEqual(ReportingStatus.CLOSED);
      expect(reportingAfter.actionBy[0].firstName).toEqual(staffData.firstName);
      expect(reportingAfter.actionBy[0].lastName).toEqual(staffData.lastName);
      expect(reportingAfter.actionBy[0].email).toEqual(staffData.email);
      expect(reportingAfter.actionBy[0].subject).toEqual('testsubjectByAdmin');
    });

    it('should update reporting user illegal', async () => {
      const reporting = await repository.findReporting({
        user: mocksUsers[5].user._id,
        type: ReportingType.USER,
      });

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.USER,
          subjectByAdmin: 'testsubjectByAdmin',
        },
        staffData as Staff,
        ReportingIllegal.ILLEGAL,
      );

      const userFollower = await repository.findUser({
        _id: mocksUsers[4].user.id,
      });

      expect(userFollower.followerCount).toEqual(0);
      expect(userFollower.followedCount).toEqual(0);

      const user = await repository.findUser({
        _id: reporting.payload._id,
        visibility: EntityVisibility.Illegal,
      });

      await userService.updateAppealUser(user, ReportingStatus.APPEAL);

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.USER,
          subjectByAdmin: 'testsubjectByAdmin2',
        },
        staffData as Staff,
        ReportingIllegal.NOT_ILLEGAL,
      );

      const userFollowerAgain = await repository.findUser({
        _id: mocksUsers[4].user.id,
      });

      expect(userFollowerAgain.followerCount).toEqual(1);
      expect(userFollowerAgain.followedCount).toEqual(1);

      const reportingAfter = await repository.findReporting({
        _id: reporting.id,
      });

      const userAfter = await repository.findUser({
        _id: reporting.payload._id,
      });

      expect(userAfter.visibility).toEqual(EntityVisibility.Publish);
      expect(reportingAfter.status).toEqual(ReportingStatus.CLOSED);
      expect(reportingAfter.actionBy[0].firstName).toEqual(staffData.firstName);
      expect(reportingAfter.actionBy[0].lastName).toEqual(staffData.lastName);
      expect(reportingAfter.actionBy[0].email).toEqual(staffData.email);
      expect(reportingAfter.actionBy[0].subject).toEqual('testsubjectByAdmin');
    });
  });

  describe('updateIllegal', () => {
    beforeAll(async () => {
      await mocksUsers[2].user.follow(mocksUsers[1].user);
      await mocksUsers[1].user.follow(mocksUsers[2].user);
    });

    it('should update reporting user illegal', async () => {
      const reporting = await repository.findReporting({
        user: mocksUsers[2].user._id,
        type: ReportingType.USER,
      });

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.USER,
          subjectByAdmin: 'testsubjectByAdmin',
        },
        staffData as Staff,
        ReportingIllegal.ILLEGAL,
      );

      const userFollower = await repository.findUser({
        _id: mocksUsers[1].user.id,
      });

      expect(
        await repository.findRelationships({
          userId: mocksUsers[2].user.id,
        }),
      ).toHaveLength(1);

      expect(
        await repository.findRelationships({
          followedUser: mocksUsers[2].user.id,
        }),
      ).toHaveLength(1);

      expect(userFollower.followerCount).toEqual(0);
      expect(userFollower.followedCount).toEqual(0);

      const user = await repository.findUser({
        _id: reporting.payload._id,
        visibility: EntityVisibility.Illegal,
      });

      await userService.updateAppealUser(user, ReportingStatus.APPEAL);

      await service.updateIllegal(
        {
          id: reporting.payload._id,
          type: ReportingType.USER,
          subjectByAdmin: 'testsubjectByAdmin2',
        },
        staffData as Staff,
        ReportingIllegal.ILLEGAL,
      );

      expect(
        await repository.findRelationships({
          userId: mocksUsers[2].user.id,
        }),
      ).toHaveLength(0);

      expect(
        await repository.findRelationships({
          followedUser: mocksUsers[2].user.id,
        }),
      ).toHaveLength(0);

      const reportingAfter = await repository.findReporting({
        _id: reporting.id,
      });

      const userAfter = await repository.findUser({
        _id: reporting.payload._id,
        visibility: EntityVisibility.Deleted,
      });

      expect(userAfter.visibility).toEqual(EntityVisibility.Deleted);
      expect(reportingAfter.status).toEqual(ReportingStatus.CLOSED);
      expect(reportingAfter.actionBy[0].firstName).toEqual(staffData.firstName);
      expect(reportingAfter.actionBy[0].lastName).toEqual(staffData.lastName);
      expect(reportingAfter.actionBy[0].email).toEqual(staffData.email);
      expect(reportingAfter.actionBy[0].subject).toEqual('testsubjectByAdmin');
    });
  });
});
