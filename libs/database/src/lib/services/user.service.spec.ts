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
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { UserProducer } from '@castcle-api/utils/queue';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import {
  ContentType,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  ShortPayload,
  UserField,
} from '../dtos';
import {
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility,
  Pagination,
} from '../dtos/common.dto';
import { PageDto, UpdateModelUserDto } from '../dtos/user.dto';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { WalletType } from '../models';
import {
  Account,
  Comment,
  Content,
  Credential,
  Transaction,
  User,
} from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('User Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: UserService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let commentService: CommentService;
  let transactionModel: Model<Transaction>;
  let result: {
    accountDocument: Account;
    credentialDocument: Credential;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        CommentService,
        UserProducer,
        HashtagService,
      ],
    }).compile();

    service = app.get<UserService>(UserService);
    transactionModel = (service as any).transactionModel;
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentService = app.get(CommentService);
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
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
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
          avatar: {
            original: 'http://placehold.it/200x200',
          },
          cover: {
            original: 'http://placehold.it/200x200',
          },
        },
        links: {
          website: 'https://djjam.app',
          facebook: 'https://facebook.com/modernduck',
          medium: 'https://medium.com/xbcd',
          twitter: 'https://twitter.com/npop',
          youtube: ' https://youtube.com/channel/abcd',
        },
      } as UpdateModelUserDto;
      const FullDTO = {
        dob: '1987-01-01',
        overview: 'long overview',
        images: {
          avatar: {
            original: 'http://placehold.it/200x200',
          },
          cover: {
            original: 'http://placehold.it/200x200',
          },
        },
        links: {
          website: 'https://ddjjam.app',
          facebook: 'https://facebook.com/modernduck1',
          medium: 'https://medium.com/xbcd2',
          twitter: 'https://twitter.com/npop3',
          youtube: ' https://youtube.com/channel/abcd4',
        },
      } as UpdateModelUserDto;
      const userFromCredential = await service.getUserFromCredential(
        result.credentialDocument
      );
      expect((await userFromCredential.toUserResponse()).dob).toBeNull();
      let updatingUser = await service.updateUser(userFromCredential, {
        dob: partialDTO.dob,
      });
      expect(updatingUser.profile.birthdate).toEqual(partialDTO.dob);
      expect((await updatingUser.toUserResponse()).dob).toEqual(partialDTO.dob);
      updatingUser = await service.updateUser(userFromCredential, {
        overview: partialDTO.overview,
      });
      expect((await updatingUser.toUserResponse()).overview).toEqual(
        partialDTO.overview
      );
      updatingUser = await service.updateUser(userFromCredential, {
        images: partialDTO.images,
        links: {
          website: partialDTO.links.website,
          facebook: partialDTO.links.facebook,
        },
      });
      expect(updatingUser.profile.images.avatar).toEqual(
        partialDTO.images.avatar
      );
      expect(updatingUser.profile.images.cover).toEqual(
        partialDTO.images.cover
      );
      expect((await updatingUser.toUserResponse()).images).toBeDefined();
      expect((await updatingUser.toUserResponse()).links).toEqual({
        website: partialDTO.links.website,
        facebook: partialDTO.links.facebook,
      });
      updatingUser = await service.updateUser(userFromCredential, FullDTO);
      const fullResponse = await updatingUser.toUserResponse();
      Object.keys(FullDTO).forEach((field) => {
        if (field != 'images')
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
        displayName: 'new Page',
        castcleId: 'npop',
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
      const allPages = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      expect(allPages.items.length).toEqual(1);
      expect(allPages.pagination.limit).toEqual(25);
      await service.createPageFromUser(currentUser, {
        displayName: 'new Page',
        castcleId: 'npop2',
      });
      const allPages2 = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      expect(allPages2.items.length).toEqual(2);
    });
  });
  describe('#getUserPages()', () => {
    it('should list all page that user created', async () => {
      const currentUser = await service.getUserFromCredential(
        result.credentialDocument
      );
      const ownPages = await service.getUserPages(
        currentUser,
        DEFAULT_QUERY_OPTIONS
      );
      expect(ownPages.items.length).toEqual(2);
      expect(ownPages.pagination.limit).toEqual(25);
    });
  });
  describe('#follow()', () => {
    let currentUser: User;
    let allPages: {
      items: User[];
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
      const afterFollowUser = await service.getByIdOrCastcleId(currentUser._id);
      expect(afterFollowUser.followedCount).toEqual(1);
      const page = await service.getByIdOrCastcleId(allPages.items[0]._id);
      expect(page.followerCount).toEqual(1);
      const relationship = await service._relationshipModel
        .findOne({ user: afterFollowUser._id, followedUser: page._id })
        .exec();
      expect(relationship).not.toBeNull();
      expect(relationship.user).not.toBeNull();
      expect(relationship.followedUser).not.toBeNull();
      expect(relationship.following).toBeTruthy();
      expect(relationship.blocking).toBeFalsy();
    });
    it('should not have 2 records if you double follow', async () => {
      const postUser = await service.getByIdOrCastcleId(currentUser._id);
      const postPage = await service.getByIdOrCastcleId(allPages.items[0]._id);
      expect(postUser.followedCount).toEqual(1);
      expect(postPage.followerCount).toEqual(1);
      await postUser.follow(postPage);
      const postUser2 = await service.getByIdOrCastcleId(currentUser._id);
      const postPage2 = await service.getByIdOrCastcleId(allPages.items[0]._id);
      expect(postUser2.followedCount).toEqual(1);
      expect(postPage2.followerCount).toEqual(1);
    });
  });
  describe('#unfollow()', () => {
    it('should work the same as follow', async () => {
      const currentUser: User = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages: {
        items: User[];
        pagination: Pagination;
      } = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      expect(currentUser.followedCount).toEqual(1); //from above
      expect(allPages.items[0].followerCount).toEqual(1);
      //try unfollow
      await currentUser.unfollow(allPages.items[0]);
      const afterFollowUser = await service.getByIdOrCastcleId(currentUser._id);
      expect(afterFollowUser.followedCount).toEqual(0);
      const page = await service.getByIdOrCastcleId(allPages.items[0]._id);
      expect(page.followerCount).toEqual(0);
      const relationship = await service._relationshipModel
        .findOne({ user: afterFollowUser._id, followedUser: page._id })
        .exec();
      expect(relationship).toBeNull();
      //try double unfollow
      await currentUser.unfollow(allPages.items[0]);
      const afterFollowUser2 = await service.getByIdOrCastcleId(
        currentUser._id
      );
      expect(afterFollowUser.followedCount).toEqual(0);
      const page2 = await service.getByIdOrCastcleId(allPages.items[0]._id);
      expect(page2.followerCount).toEqual(0);
      const relationship2 = await service._relationshipModel
        .findOne({ user: afterFollowUser2._id, followedUser: page2._id })
        .exec();
      expect(relationship2).toBeNull();
    });
  });
  describe('#getFollower()', () => {
    it('should get user detail from followers', async () => {
      const currentUser: User = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages: {
        items: User[];
        pagination: Pagination;
      } = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      await currentUser.follow(allPages.items[0]);
      await currentUser.follow(allPages.items[1]);
      const followers = await service.getFollowers(
        currentUser,
        allPages.items[0],
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );

      expect(followers.users.length).toEqual(1);
      expect(followers.users[0].castcleId).toEqual(
        (await currentUser.toUserResponse()).castcleId
      );
    });
  });
  //TODO !!! Need better testing and mock data
  describe('#getFollowing()', () => {
    it('should get total of following correctly', async () => {
      const currentUser: User = await service.getUserFromCredential(
        result.credentialDocument
      );
      const allPages = await service.getAllPages(DEFAULT_QUERY_OPTIONS);
      const following = await service.getFollowing(currentUser, currentUser, {
        maxResults: 5,
        hasRelationshipExpansion: false,
      });
      //like in #getFollower
      expect(following.users.length).toEqual(allPages.items.length);
    });
  });

  describe('#deactivate, reactivate', () => {
    const userInfo = {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'npop',
        displayName: 'npop',
        email: 'sompop.k@gmail.com',
        password: '123456789',
      },
      pages: [
        {
          avatar: {
            original: 'http://placehold.it/200x200',
          },
          castcleId: 'test-12345',
          cover: {
            original: 'http://placehold.it/200x200',
          },
          displayName: 'hello12345',
        } as PageDto,
      ],
    };

    let userA: User;
    let pageA: User;
    let accountA: Account;
    beforeAll(async () => {
      //create new user
      const result = await authService.createAccount(
        userInfo.accountRequirement
      );
      accountA = result.accountDocument;
      await authService.signupByEmail(accountA, userInfo.signupRequirement);
      userA = await service.getUserFromCredential(result.credentialDocument);
      pageA = await service.createPageFromUser(userA, userInfo.pages[0]);
    });
    describe('#deactive()', () => {
      let postUserAFromModel: User;
      let postUserA: User;
      let postPageAFromModel: User;
      let postPageA: User;
      let postAccountA: Account;
      beforeAll(async () => {
        await service.deactive(userA);
        postUserAFromModel = await service._userModel.findById(userA._id);
        postUserA = await service.getByIdOrCastcleId(userA._id);
        postPageAFromModel = await service._userModel.findById(pageA._id);
        postPageA = await service.getByIdOrCastcleId(pageA._id);
        postAccountA = await authService._accountModel.findById(accountA._id);
      });
      it('should set status user to delete', async () => {
        expect(postUserAFromModel.visibility).toEqual(EntityVisibility.Deleted);
        expect(postUserA).toBeNull();
      });
      it('should set all page that user own to delete flag', async () => {
        expect(postPageAFromModel.visibility).toEqual(EntityVisibility.Deleted);
        expect(postPageA).toBeNull();
      });
      it('should set account of user to Delete', () => {
        expect(postAccountA.visibility).toEqual(EntityVisibility.Deleted);
      });
    });
    describe('#reactive()', () => {
      let postUserAFromModel: User;
      let postUserA: User;
      let postPageAFromModel: User;
      let postPageA: User;
      let postAccountA: Account;
      beforeAll(async () => {
        await service.reactive(userA);
        postUserAFromModel = await service._userModel.findById(userA._id);
        postUserA = await service.getByIdOrCastcleId(userA._id);
        postPageAFromModel = await service._userModel.findById(pageA._id);
        postPageA = await service.getByIdOrCastcleId(pageA._id);
        postAccountA = await authService._accountModel.findById(accountA._id);
      });
      it('should set status user to publish', async () => {
        expect(postUserAFromModel.visibility).toEqual(EntityVisibility.Publish);
        expect(postUserA).not.toBeNull();
      });
      it('should set all page that user own to publish flag', async () => {
        expect(postPageAFromModel.visibility).toEqual(EntityVisibility.Publish);
        expect(postPageA).not.toBeNull();
      });
      it('should set account of user to publish', () => {
        expect(postAccountA.visibility).toEqual(EntityVisibility.Publish);
      });
    });
  });

  describe('Deactivated', () => {
    let userA: User;
    let userB: User;
    let accountB: Account;
    let userNotDelete: User;
    const contents: Content[] = [];
    const contentsB: Content[] = [];
    const fixContents: Content[] = [];
    const userInfo = {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'npop2',
        displayName: 'npop2',
        email: 'sompop.kulapalanont@gmail.com',
        password: '2@HelloWorld',
      },
      pages: [
        {
          avatar: 'http:/placehold.it/200x200',
          castcleId: 'testC2345',
          cover: 'http:/placehold.it/200x200',
          displayName: 'hello12345',
        } as PageDto,
      ],
    };
    const userOverAllInfo = {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'npop7',
        displayName: 'npop7',
        email: 'sompop7.kulapalanont@gmail.com',
        password: '2@HelloWorld',
      },
      pages: [
        {
          avatar: 'http:/placehold.it/200x200',
          castcleId: 'testC2347',
          cover: 'http:/placehold.it/200x200',
          displayName: 'hello12347',
        } as PageDto,
      ],
    };
    const userNotDeleteInfo = {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'npop3',
        displayName: 'npop3',
        email: 'sompop3.kulapalanont@gmail.com',
        password: '2@HelloWorld',
      },
      pages: [
        {
          avatar: 'http:/placehold.it/200x200',
          castcleId: 'testYoC2345',
          cover: 'http:/placehold.it/200x200',
          displayName: 'hello12345',
        } as PageDto,
      ],
    };
    let testLikeComment: Comment;

    beforeAll(async () => {
      const result = await authService.createAccount(
        userInfo.accountRequirement
      );
      const accountActiation = await authService.signupByEmail(
        result.accountDocument,
        userInfo.signupRequirement
      );
      await authService.verifyAccount(accountActiation);
      userA = await service.getUserFromCredential(result.credentialDocument);
      const result2 = await authService.createAccount(
        userNotDeleteInfo.accountRequirement
      );
      const accountActiation2 = await authService.signupByEmail(
        result2.accountDocument,
        userNotDeleteInfo.signupRequirement
      );
      await authService.verifyAccount(accountActiation2);
      userNotDelete = await service.getUserFromCredential(
        result2.credentialDocument
      );
      //let userA follower UserNotDelete
      await service.follow(userA, userNotDelete);

      //overall
      const result3 = await authService.createAccount(
        userOverAllInfo.accountRequirement
      );
      const accountActivation3 = await authService.signupByEmail(
        result3.accountDocument,
        userOverAllInfo.signupRequirement
      );
      await authService.verifyAccount(accountActivation3);
      accountB = result3.accountDocument;
      userB = await service.getUserFromCredential(result3.credentialDocument);
      await service.follow(userB, userNotDelete);

      contents[0] = await contentService.createContentFromUser(userA, {
        type: ContentType.Short,
        payload: {
          message: 'this is short1',
        } as ShortPayload,
        castcleId: userA.displayId,
      });
      contents[1] = await contentService.createContentFromUser(userA, {
        type: ContentType.Short,
        payload: {
          message: 'this is short2',
        } as ShortPayload,
        castcleId: userA.displayId,
      });
      //b
      contentsB[0] = await contentService.createContentFromUser(userB, {
        type: ContentType.Short,
        payload: {
          message: 'this is short1',
        } as ShortPayload,
        castcleId: userB.displayId,
      });
      contentsB[1] = await contentService.createContentFromUser(userB, {
        type: ContentType.Short,
        payload: {
          message: 'this is short2',
        } as ShortPayload,
        castcleId: userB.displayId,
      });

      fixContents[0] = await contentService.createContentFromUser(
        userNotDelete,
        {
          type: ContentType.Short,
          payload: {
            message: 'this is short1',
          } as ShortPayload,
          castcleId: userNotDelete.displayId,
        }
      );

      fixContents[1] = await contentService.createContentFromUser(
        userNotDelete,
        {
          type: ContentType.Short,
          payload: {
            message: 'this is short2',
          } as ShortPayload,
          castcleId: userNotDelete.displayId,
        }
      );

      testLikeComment = await contentService.createCommentForContent(
        userNotDelete,
        fixContents[0],
        { message: 'testLikeComment' }
      );
      await contentService.createCommentForContent(userA, fixContents[0], {
        message: 'test Comment',
      });
      await contentService.createCommentForContent(userB, fixContents[0], {
        message: 'test Comment',
      });

      await contentService.likeContent(fixContents[0], userA);
      await contentService.likeContent(fixContents[1], userA);
      //B
      await contentService.likeContent(fixContents[0], userB);
      await contentService.likeContent(fixContents[1], userB);
      await contentService.likeComment(userA, testLikeComment);
      await contentService.likeComment(userB, testLikeComment);
    });
    describe('_removeAllContentFromUser()', () => {
      it('should flag all content from user to deleted', async () => {
        //service._removeAllContentFromUser()
        const preContents = await contentService.getContentsFromUser(userA.id);
        expect(preContents.total).toEqual(contents.length);
        await service._removeAllContentFromUser(userA);
        const postContents = await contentService.getContentsFromUser(userA.id);
        expect(postContents.total).toEqual(0);
      });
      // /it('should update the recast counter from original content', async () => {});
    });
    describe('_removeAllEngagements()', () => {
      it('should update like amount of contents', async () => {
        const preContent = await contentService.getContentFromId(
          fixContents[0]._id
        );
        const contentPayload = preContent.toContentPayload();
        const preComment = await contentService.getCommentById(
          testLikeComment._id
        );
        console.debug('_removeAllEngagementsPre', contentPayload);
        expect(contentPayload.liked.count).toEqual(2);
        expect(preComment.engagements.like.count).toEqual(2);
        await service._removeAllEngagements(userA);
        const postContent = await contentService.getContentFromId(
          fixContents[0]._id
        );
        const postContentPayload = postContent.toContentPayload();
        expect(postContentPayload.liked.count).toEqual(1);
        const postComment = await contentService.getCommentById(
          testLikeComment._id
        );
        expect(postComment.engagements.like.count).toEqual(1);
      });
    });
    describe('_removeAllFollower()', () => {
      it('should flag all content from user to deleted', async () => {
        const preFollower = await service.getFollowers(
          userNotDelete,
          userNotDelete,
          {
            maxResults: 5,
            hasRelationshipExpansion: false,
          }
        );
        expect(preFollower.users.length).toEqual(2);
        await service._removeAllFollower(userA);
        const postFollower = await service.getFollowers(
          userNotDelete,
          userNotDelete,
          {
            maxResults: 5,
            hasRelationshipExpansion: false,
          }
        );
        expect(postFollower.users.length).toEqual(1);
      });
    });
    describe('_removeAllCommentFromUser()', () => {
      it('should flag all comment from user to hidden', async () => {
        const comments = await commentService.getCommentsByContentId(
          userA,
          fixContents[0]._id
        );
        expect(comments.payload.length).toEqual(3);
        expect(comments.meta.resultCount).toEqual(3);
        await service._removeAllCommentFromUser(userA);
        const comments2 = await commentService.getCommentsByContentId(
          userA,
          fixContents[0]._id
        );
        expect(comments2.meta.resultCount).toEqual(2);
        expect(comments2.payload.length).toEqual(2);
      });
    });
    describe('_deactiveAccount()', () => {
      it('should use all remove functions above to completely deactivate account', async () => {
        await service._deactiveAccount(accountB);
        const postAccountB = await authService._accountModel
          .findById(accountB._id)
          .exec();
        expect(postAccountB.visibility).toEqual(EntityVisibility.Deleted);
        //remove all comment / follower and engagement
        const comments2 = await commentService.getCommentsByContentId(
          userA,
          fixContents[0]._id
        );
        expect(comments2.meta.resultCount).toEqual(1);
        const postFollower = await service.getFollowers(
          userNotDelete,
          userNotDelete,
          {
            maxResults: 5,
            hasRelationshipExpansion: false,
          }
        );
        expect(postFollower.users.length).toEqual(0);
        const postContent = await contentService.getContentFromId(
          fixContents[0]._id
        );
        const postContentPayload = postContent.toContentPayload();
        expect(postContentPayload.liked.count).toEqual(0);
        const postComment = await contentService.getCommentById(
          testLikeComment._id
        );
        expect(postComment.engagements.like.count).toEqual(0);
      });
    });
  });

  describe('#getMentionsFromPublic()', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(5, 2, {
        userService: service,
        accountService: authService,
      });
      await service.follow(mocksUsers[1].user, mocksUsers[0].user);
      await service.follow(mocksUsers[2].user, mocksUsers[0].user);
      await service.follow(mocksUsers[3].user, mocksUsers[0].user);
      await service.follow(mocksUsers[4].user, mocksUsers[0].user);
      await service.follow(mocksUsers[0].user, mocksUsers[1].user);
      await service.follow(mocksUsers[2].user, mocksUsers[1].user);
      await service.follow(mocksUsers[3].user, mocksUsers[1].user);
    });
    it('should get all users and page that order by who has follower the most', async () => {
      const mentions = await service.getMentionsFromPublic(
        mocksUsers[0].user,
        'mock',
        {
          limit: 5,
          page: 1,
        }
      );
      const updatedUser = await service.getByIdOrCastcleId(
        mocksUsers[0].user._id
      );
      const updatedUser2 = await service.getByIdOrCastcleId(
        mocksUsers[1].user._id
      );
      expect(mentions.users.length).toEqual(5);
      expect(mentions.users[0]).toEqual(await updatedUser.toUserResponse());
      expect(mentions.users[0].followers.count).toEqual(4);
      expect(mentions.users[1]).toEqual(await updatedUser2.toUserResponse());
      expect(mentions.users[1].followers.count).toEqual(3);
    });
    it('should get all users if query is empty string', async () => {
      const mentions = await service.getMentionsFromPublic(
        mocksUsers[0].user,
        '',
        {
          limit: 2,
          page: 1,
        }
      );
      expect(mentions.users.length).toEqual(2);
      const updatedUser = await service.getByIdOrCastcleId(
        mocksUsers[0].user._id
      );
      const updatedUser2 = await service.getByIdOrCastcleId(
        mocksUsers[1].user._id
      );
      expect(mentions.users[0]).toEqual(await updatedUser.toUserResponse());
      expect(mentions.users[0].followers.count).toEqual(4);
      expect(mentions.users[1]).toEqual(await updatedUser2.toUserResponse());
      expect(mentions.users[1].followers.count).toEqual(3);
    });
  });

  describe('#blockUser', () => {
    let user1: User;
    let user2: User;

    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(2, 0, {
        userService: service,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
      await service._relationshipModel.deleteMany({});
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await expect(service.blockUser(user1, null)).rejects.toMatchObject({
        response: { code: '4001' },
      });
    });

    it('should block user and create blocking relationship', async () => {
      await service.blockUser(user1, user2);
      const relationship = await service._relationshipModel
        .findOne({ user: user1._id, followedUser: user2._id })
        .exec();

      expect(relationship).not.toBeNull();
      expect(relationship.blocking).toBeTruthy();
      expect(relationship.following).toBeFalsy();
    });

    it('should block following user and update relationship', async () => {
      await service.follow(user1, user2);
      await service.blockUser(user1, user2);
      const relationship = await service._relationshipModel
        .findOne({ user: user1._id, followedUser: user2._id })
        .exec();

      expect(relationship).not.toBeNull();
      expect(relationship.blocking).toBeTruthy();
      expect(relationship.following).toBeTruthy();
    });
  });

  describe('#unblockUser', () => {
    let user1: User;
    let user2: User;

    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(2, 0, {
        userService: service,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
      await service._relationshipModel.deleteMany({});
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to unblock is not found', async () => {
      await expect(service.blockUser(user1, null)).rejects.toMatchObject({
        response: { code: '4001' },
      });
    });

    it('should abort when user to unblock is not followed', async () => {
      await service.unblockUser(user1, user2);
      const relationship = await service._relationshipModel
        .findOne({ user: user1._id, followedUser: user2._id })
        .exec();

      expect(relationship).toBeNull();
    });

    it('should unblock following user and update relationship', async () => {
      await service.follow(user1, user2);
      await service.unblockUser(user1, user2);
      const relationship = await service._relationshipModel
        .findOne({ user: user1._id, followedUser: user2._id })
        .exec();

      expect(relationship).not.toBeNull();
      expect(relationship.blocking).toBeFalsy();
      expect(relationship.following).toBeTruthy();
    });
  });

  describe('#reportUser', () => {
    let user1: User;
    let user2: User;

    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(2, 0, {
        userService: service,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to report is not found', async () => {
      await expect(
        service.reportUser(user1, null, 'message')
      ).rejects.toMatchObject({ response: { code: '4001' } });
    });

    it('should report user by sending email to Castcle admin', async () => {
      jest
        .spyOn((service as any).transporter, 'sendMail')
        .mockReturnValueOnce({ messageId: 1 });

      await service.reportUser(user1, user2, 'message');
      expect((service as any).logger.log).toBeCalled();
      expect((service as any).transporter.sendMail).toBeCalled();
    });
  });

  describe('#getByIdOrCastcleId', () => {
    let user: User;

    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;
      user.displayId = 'displayId';
      await user.save();
    });

    afterAll(async () => {
      await user.deleteOne();
    });

    it('should return null when user to find is not found', async () => {
      await expect(
        service.getByIdOrCastcleId('xxxxxxxxxx')
      ).resolves.toBeNull();
    });

    it('should return user when find user with castcle ID or ID', async () => {
      const userFromId = await service.getByIdOrCastcleId(String(user._id));

      const userFromCastcleId = await service.getByIdOrCastcleId(
        user.displayId
      );

      expect(userFromId).toMatchObject(userFromCastcleId);
    });
  });

  describe('#updateMobile', () => {
    let user: User;
    let account: Account;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;
      account = mocksUsers[0].account;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should update mobile and verify user and account', async () => {
      const countryCode = '+66';
      const mobile = '0814567890';
      await service.updateMobile(user, account._id, countryCode, mobile);
      const userUpdate = await service.getByIdOrCastcleId(user.id);
      const accountUpdate = await authService.getAccountFromId(account.id);

      expect(userUpdate).not.toBeNull();
      expect(userUpdate.verified.mobile).toBeTruthy();
      expect(accountUpdate.mobile.countryCode).toEqual(countryCode);
      expect(accountUpdate.mobile.number).toEqual(mobile);
    });
  });

  describe('#userSettings', () => {
    let account: Account;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      account = mocksUsers[0].account;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should update settings and verify user and account', async () => {
      const expectResult = ['th', 'en'];
      await service.userSettings(account.id, expectResult);
      const accountUpdate = await authService.getAccountFromId(account.id);

      expect(accountUpdate).not.toBeNull();
      expect(accountUpdate.preferences.languages).toEqual(expectResult);
    });
  });

  describe('#createPageFromSocialSync()', () => {
    it('should create a new user that type page from SocialPageDto', async () => {
      const page = await service.createPageFromSocial(
        result.credentialDocument.account,
        {
          castcleId: 'synctest',
          displayName: 'new Sync Page',
          overview: 'sync facebook',
          avatar: {
            original: 'http://placehold.it/200x200',
          },
          cover: {
            original: 'http://placehold.it/200x200',
          },
          links: {
            facebook: 'https://facebook.com/test',
          },
        }
      );
      expect(page.type).toEqual('page');
      expect(page.displayId).toEqual('synctest');
    });
  });

  describe('#getUserFromAccountId()', () => {
    let account: Account;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 2, {
        userService: service,
        accountService: authService,
      });

      account = mocksUsers[0].account;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should get only user data', async () => {
      const currentUser = await service.getUserFromAccountId(account.id);
      expect(currentUser.user).toBeDefined();
      expect(currentUser.balance).toBeUndefined();
      expect(currentUser.authenSocial).toBeUndefined();
      expect(currentUser.syncPage).toBeUndefined();
    });

    it('should get user and userFields option', async () => {
      const currentUser = await service.getUserFromAccountId(account.id, [
        UserField.Wallet,
        UserField.LinkSocial,
        UserField.SyncSocial,
      ]);
      expect(currentUser.user).toBeDefined();
      expect(currentUser.balance).toBeDefined();
      expect(currentUser.authenSocial).toBeDefined();
      expect(currentUser.syncPage).toBeDefined();
    });

    it('should return exception when can not find user', async () => {
      await expect(
        service.getUserFromAccountId(result.accountDocument.id)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.USER_OR_PAGE_NOT_FOUND)
      );
    });
  });

  describe('Transaction Service', () => {
    const accountId = Types.ObjectId();
    const user = { ownerAccount: accountId } as unknown as User;

    it('should create new transaction from transfer()', async () => {
      const transaction = await new transactionModel({
        to: [{ account: accountId, type: WalletType.PERSONAL, value: 10 }],
      }).save();

      expect(Number(transaction.to[0].value.toString())).toEqual(10);
      expect(transaction.createdAt).toBeDefined();
    });

    it('should return user balance', async () => {
      const transaction = await transactionModel.findOne({
        'to.account': accountId,
      });

      expect(Number(transaction.to[0].value.toString())).toEqual(10);

      await expect(service.getBalance(user)).resolves.toEqual(10);

      await new transactionModel({
        from: { account: user.ownerAccount, type: WalletType.PERSONAL },
        to: [{ value: 5 }],
      }).save();

      await expect(service.getBalance(user)).resolves.toEqual(5);
    });
  });
});
