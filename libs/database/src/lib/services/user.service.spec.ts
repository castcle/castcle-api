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
import { AuthenticationService } from './authentication.service';
import { UserService } from './user.service';
import { env } from '../environment';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { MongooseForFeatures, MongooseAsyncFeatures } from '../database.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserDocument } from '../schemas/user.schema';
import { UpdateUserDto } from '../dtos/user.dto';
import { DEFAULT_CONTENT_QUERY_OPTIONS } from '../dtos';
import { DEFAULT_QUERY_OPTIONS, Pagination } from '../dtos/common.dto';

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
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('User Service', () => {
  let service: UserService;
  let authService: AuthenticationService;
  console.log('test in real db = ', env.db_test_in_db);
  const importModules = env.db_test_in_db
    ? [
        MongooseModule.forRoot(env.db_uri, env.db_options),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [UserService, AuthenticationService];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios'
      },
      device: 'ifong'
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567'
    });
  });
  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
  });

  describe('#getUserFromCredential()', () => {
    it('should get user that has the same account id', async () => {
      const userFromCredential = await service.getUserFromCredential(
        result.credentialDocument
      );
      expect(userFromCredential.ownerAccount).toEqual(
        result.accountDocument._id
      );
    });
  });

  describe('#updateUser()', () => {
    it('should update a user with specific fields', async () => {
      const partialDTO = {
        dob: '1987-12-01',
        overview: 'this is short overview',
        images: {
          avatar: 'http://agogo.com',
          cover: 'http://arovela.com'
        },
        links: {
          website: 'https://djjam.app',
          facebook: 'https://facebook.com/modernduck',
          medium: 'https://medium.com/xbcd',
          twitter: 'https://twitter.com/npop',
          youtube: ' https://youtube.com/channel/abcd'
        }
      } as UpdateUserDto;
      const FullDTO = {
        dob: '1987-01-01',
        overview: 'long overview',
        images: {
          avatar: 'http://agogo1.com',
          cover: 'http://arovela1.com'
        },
        links: {
          website: 'https://ddjjam.app',
          facebook: 'https://facebook.com/modernduck1',
          medium: 'https://medium.com/xbcd2',
          twitter: 'https://twitter.com/npop3',
          youtube: ' https://youtube.com/channel/abcd4'
        }
      } as UpdateUserDto;
      const userFromCredential = await service.getUserFromCredential(
        result.credentialDocument
      );
      expect((await userFromCredential.toUserResponse()).dob).toBeNull();
      let updatingUser = await service.updateUser(userFromCredential, {
        dob: partialDTO.dob
      });
      expect(updatingUser.profile.birthdate).toEqual(partialDTO.dob);
      expect((await updatingUser.toUserResponse()).dob).toEqual(partialDTO.dob);
      updatingUser = await service.updateUser(userFromCredential, {
        overview: partialDTO.overview
      });
      expect((await updatingUser.toUserResponse()).overview).toEqual(
        partialDTO.overview
      );
      updatingUser = await service.updateUser(userFromCredential, {
        images: partialDTO.images,
        links: {
          website: partialDTO.links.website,
          facebook: partialDTO.links.facebook
        }
      });
      expect(updatingUser.profile.images.avatar).toEqual(
        partialDTO.images.avatar
      );
      expect(updatingUser.profile.images.cover).toEqual(
        partialDTO.images.cover
      );
      expect((await updatingUser.toUserResponse()).images).toEqual(
        partialDTO.images
      );
      expect((await updatingUser.toUserResponse()).links).toEqual({
        website: partialDTO.links.website,
        facebook: partialDTO.links.facebook
      });
      updatingUser = await service.updateUser(userFromCredential, FullDTO);
      const fullResponse = await updatingUser.toUserResponse();
      Object.keys(FullDTO).forEach((field) => {
        expect(fullResponse[field]).toEqual(FullDTO[field]);
      });
    });
  });
  describe('#createPageFromUser()', () => {
    it('should create a new user that type page from PageDTO', async () => {
      const currentUser = await service.getUserFromCredential(
        result.credentialDocument
      );
      const page = await service.createPageFromUser(currentUser, {
        avatar: 'http://placehold.it/200x200',
        cover: 'http://placehold.it/900x900',
        displayName: 'new Page',
        castcleId: 'npop'
      });
      expect(page.type).toEqual('page');
      expect(page.ownerAccount).toEqual(currentUser.ownerAccount);
    });
  });
  describe('#getAllPages()', () => {
    it('should list all created pages', async () => {
      const currentUser = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages = await service.getAllPages(DEFAULT_CONTENT_QUERY_OPTIONS);
      expect(allPages.items.length).toEqual(1);
      expect(allPages.pagination.limit).toEqual(25);
      const page = await service.createPageFromUser(currentUser, {
        avatar: 'http://placehold.it/200x200',
        cover: 'http://placehold.it/900x900',
        displayName: 'new Page',
        castcleId: 'npop2'
      });
      const allPages2 = await service.getAllPages(
        DEFAULT_CONTENT_QUERY_OPTIONS
      );
      expect(allPages2.items.length).toEqual(2);
    });
  });
  describe('#follow()', () => {
    let currentUser: UserDocument;
    let allPages: {
      items: UserDocument[];
      pagination: Pagination;
    };
    beforeAll(async () => {
      currentUser = await service.getUserFromCredential(
        result.credentialDocument
      );
      allPages = await service.getAllPages(DEFAULT_CONTENT_QUERY_OPTIONS);
    });
    it('should be able to find document in relationship collection once follow', async () => {
      expect(currentUser.followedCount).toEqual(0);
      expect(allPages.items[0].followerCount).toEqual(0);
      //test follow
      await currentUser.follow(allPages.items[0]);
      const afterFollowUser = await service.getUserFromId(currentUser._id);
      expect(afterFollowUser.followedCount).toEqual(1);
      const page = await service.getUserFromId(allPages.items[0]._id);
      expect(page.followerCount).toEqual(1);
      const relationship = await service._relationshipModel
        .findOne({ user: afterFollowUser._id, followedUser: page._id })
        .exec();
      expect(relationship).not.toBeNull();
      expect(relationship.user).not.toBeNull();
      expect(relationship.followedUser).not.toBeNull();
    });
    it('should not have 2 records if you double follow', async () => {
      const postUser = await service.getUserFromId(currentUser._id);
      const postPage = await service.getUserFromId(allPages.items[0]._id);
      expect(postUser.followedCount).toEqual(1);
      expect(postPage.followerCount).toEqual(1);
      await postUser.follow(postPage);
      const postUser2 = await service.getUserFromId(currentUser._id);
      const postPage2 = await service.getUserFromId(allPages.items[0]._id);
      expect(postUser2.followedCount).toEqual(1);
      expect(postPage2.followerCount).toEqual(1);
    });
  });
  describe('#unfollow()', () => {
    it('should work the same as follow', async () => {
      const currentUser: UserDocument = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages: {
        items: UserDocument[];
        pagination: Pagination;
      } = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      expect(currentUser.followedCount).toEqual(1); //from above
      expect(allPages.items[0].followerCount).toEqual(1);
      //try unfollow
      await currentUser.unfollow(allPages.items[0]);
      const afterFollowUser = await service.getUserFromId(currentUser._id);
      expect(afterFollowUser.followedCount).toEqual(0);
      const page = await service.getUserFromId(allPages.items[0]._id);
      expect(page.followerCount).toEqual(0);
      const relationship = await service._relationshipModel
        .findOne({ user: afterFollowUser._id, followedUser: page._id })
        .exec();
      expect(relationship).toBeNull();
      //try double unfollow
      await currentUser.unfollow(allPages.items[0]);
      const afterFollowUser2 = await service.getUserFromId(currentUser._id);
      expect(afterFollowUser.followedCount).toEqual(0);
      const page2 = await service.getUserFromId(allPages.items[0]._id);
      expect(page2.followerCount).toEqual(0);
      const relationship2 = await service._relationshipModel
        .findOne({ user: afterFollowUser2._id, followedUser: page2._id })
        .exec();
      expect(relationship2).toBeNull();
    });
  });
  describe('#getFollower()', () => {
    it('should get user detail from followering', async () => {
      const currentUser: UserDocument = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages: {
        items: UserDocument[];
        pagination: Pagination;
      } = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      await currentUser.follow(allPages.items[0]);
      await currentUser.follow(allPages.items[1]);
      const followers = await service.getFollower(
        allPages.items[0],
        DEFAULT_QUERY_OPTIONS
      );
      expect(followers.items.length).toEqual(1);
      expect(followers.items[0].castcleId).toEqual(
        (await currentUser.toUserResponse()).castcleId
      );
    });
  });
  //TODO !!! Need better testing and mock data
  describe('#getFollowing()', () => {
    it('should get total of following correctly', async () => {
      const currentUser: UserDocument = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages: {
        items: UserDocument[];
        pagination: Pagination;
      } = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      const following = await service.getFollowing(currentUser);
      //like in #getFollower
      expect(following.items.length).toEqual(allPages.items.length);
    });
  });
});
