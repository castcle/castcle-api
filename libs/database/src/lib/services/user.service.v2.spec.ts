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

import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  MongooseAsyncFeatures,
  MongooseForFeatures,
  UserService,
  UserServiceV2,
} from '../database.module';
import { QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, AccountActivation, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { HttpModule } from '@nestjs/axios';

describe('UserServiceV2', () => {
  let mongod: MongoMemoryReplSet;
  let userServiceV2: UserServiceV2;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let guestDemo: {
    accountDocument: Account;
    credentialDocument: Credential;
  };
  let accountDemo: AccountActivation;
  let userDemo: User;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    const module = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri(), { useCreateIndex: true }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        ContentService,
        CommentService,
        Repository,
        UserService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        UserService,
        UserServiceV2,
      ],
    }).compile();

    userServiceV2 = module.get<UserServiceV2>(UserServiceV2);
    userServiceV1 = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
    guestDemo = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    //sign up to create actual account
    accountDemo = await authService.signupByEmail(guestDemo.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });

    userDemo = await authService.getUserFromAccount(accountDemo.account);
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('#getMyPages', () => {
    it('should return undefined when user have no page', async () => {
      const result = await userServiceV2.getMyPages(userDemo);
      expect(result[0]).toBeUndefined();
    });

    it('should return page of user when created', async () => {
      await userServiceV1.createPageFromCredential(
        guestDemo.credentialDocument,
        {
          castcleId: accountDemo.account.id,
          displayName: 'sp002',
        }
      );
      const pages = await userServiceV2.getMyPages(userDemo);
      expect(pages[0]).toBeDefined();
    });
  });
});
