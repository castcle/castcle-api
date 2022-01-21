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
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { env } from '../environment';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RankerService } from './ranker.service';
import { ContentService } from './content.service';
import { UserService } from './user.service';
import { AuthenticationService } from './authentication.service';
import {
  AccountDocument,
  ContentDocument,
  CredentialDocument,
  UserDocument,
} from '../schemas';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ContentType, ShortPayload } from '../dtos';
import { DEFAULT_FEED_QUERY_OPTIONS } from '../dtos/feedItem.dto';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { HashtagService } from './hashtag.service';
jest.mock('@castcle-api/utils/aws', () => ({
  predictContents: jest.fn((accountIds: string, contents: string[]) => {
    const map: any = {};
    contents.forEach((item, index) => {
      map[item] = index + 1;
    });
    return map;
  }),
}));
const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380,
  },
  processors: [fakeProcessor],
});
let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('Ranker Service', () => {
  let service: RankerService;
  let contentService: ContentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: UserDocument;
  let follower: UserDocument;
  let followerAccount: AccountDocument;
  const contents: ContentDocument[] = [];
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull,
      ]
    : [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull,
      ];
  const providers = [
    ContentService,
    UserService,
    AuthenticationService,
    RankerService,
    UserProducer,
    HashtagService,
  ];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<RankerService>(RankerService);

    contentService = module.get<ContentService>(ContentService);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });
    user = await userService.getUserFromCredential(result.credentialDocument);
    const followerResult = await authService.createAccount({
      deviceUUID: 'followerAbcde',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    await authService.signupByEmail(followerResult.accountDocument, {
      displayId: 'followerNa',
      displayName: 'followerNa002',
      email: 'sompop2.kulapalanont@gmail.com',
      password: '2@Test12345678',
    });
    //let follower follow user
    follower = await userService.getUserFromCredential(
      followerResult.credentialDocument
    );
    await userService.follow(follower, user);
    followerAccount = await authService.getAccountFromEmail(
      'sompop2.kulapalanont@gmail.com'
    );
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });
  describe('#getAndcreateFeedItemByCreateTime()', () => {
    const shortPayload: ShortPayload = {
      message: 'this is test status',
    };
    const shortPayload2: ShortPayload = {
      message: 'this is test status2',
    };
    const shortPayload3: ShortPayload = {
      message: 'this is test status3',
    };
    const shortPayload4: ShortPayload = {
      message: 'this is test status4',
    };
    const shortPayload5: ShortPayload = {
      message: 'this is test status5',
    };
    beforeAll(async () => {
      contents[0] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      contents[1] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId,
      });
      contents[2] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload3,
        castcleId: user.displayId,
      });
      contents[2] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload4,
        castcleId: user.displayId,
      });
      contents[4] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload5,
        castcleId: user.displayId,
      });
    });
    it('should create feedItem after create a content', async () => {
      const totalFeedItem = await service._feedItemModel.countDocuments();
      expect(totalFeedItem).toEqual(contents.length);
      const feedItems = await service._feedItemModel.find().exec();
      expect(feedItems.length).toEqual(contents.length);
    });
    it('should get documents from ContentItems that seen = false', async () => {
      const feedItems = await service.getFeedItemsFromViewer(followerAccount, {
        ...DEFAULT_FEED_QUERY_OPTIONS,
        limit: 2,
      });
      expect(feedItems.total).toEqual(contents.length);
      expect(feedItems.pagination.limit).toEqual(2);
      expect(feedItems.items[0].content.payload).toEqual(shortPayload5);
      expect(feedItems.items[1].content.payload).toEqual(shortPayload4);
      expect(feedItems.items[2]).toBeUndefined();
    });
  });
  //TODO !!! Have to add test later on
  /*describe('#getMemberFeedItemsFromViewer', () => {
    it('should be able to view normal feed', async() => {

    })
    it('should fill up content from guestFeed if not so much content right now', async() => {

    })
    it('should not be able to view called content', async () =>{

    })
  })*/
});
