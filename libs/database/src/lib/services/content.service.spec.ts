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

import { CastcleException } from '@castcle-api/utils/exception';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  CommentService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { EntityVisibility, SortDirection } from '../dtos';
import { Author, SaveContentDto, ShortPayload } from '../dtos/content.dto';
import { MockUserDetail, generateMockUsers } from '../mocks/user.mocks';
import { ContentType, QueueName } from '../models';
import { Account, Comment, Content, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('ContentService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: ContentService;
  let commentService: CommentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: User;
  let author: Author;
  /**
   * For multiple user
   */
  const userInfo = [
    {
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
        password: '2@HelloWorld',
      },
    },
    {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone5678',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'sompop',
        displayName: 'sompop',
        email: 'sompop.ku@gmail.com',
        password: '2@HelloWorld',
      },
    },
    {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: 'kuku',
        displayName: 'kuku',
        email: 'sompop.kuku@gmail.com',
        password: '2@HelloWorld',
      },
    },
  ];
  let result: {
    accountDocument: Account;
    credentialDocument: Credential;
  };
  let hashtagContent: Content;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationService,
        ContentService,
        CommentService,
        HashtagService,
        UserService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get<ContentService>(ContentService);
    commentService = moduleRef.get(CommentService);
    userService = moduleRef.get<UserService>(UserService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
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
    author = new Author({
      id: user.id,
      type: 'page',
      castcleId: 'castcleId',
      displayName: 'Castcle',
      verified: { email: true, mobile: true, official: true, social: true },
      avatar: null,
    });
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#createContentFromUser', () => {
    it('should create short content instance in db with author as user', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status',
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      expect((content.payload as ShortPayload).message).toEqual(
        shortPayload.message,
      );
      expect(content.type).toEqual(ContentType.Short);
      expect(content.author.id).toEqual(user._id);
      expect(content.revisionCount).toEqual(1);
      expect(content.toContentPayload().author.verified).toEqual({
        email: false,
        mobile: false,
        official: false,
        social: false,
      });
    });
    it('should create a hashtag stat', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status #cool #yo',
      };
      hashtagContent = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      const hashtags = await service.hashtagService.getAll();
      expect(hashtags.length).toEqual(2);
      expect(['cool', 'yo']).toContain(hashtags[0].tag);
      expect(['cool', 'yo']).toContain(hashtags[1].tag);
      expect(hashtags[0].score).toEqual(1);
      expect(hashtags[1].score).toEqual(1);
    });
  });
  describe('#updateContentFromId()', () => {
    it('should update from saveDTO with content id', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status',
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      expect(content.revisionCount).toEqual(1);
      const updatePayload: ShortPayload = {
        message: 'this is test status2',
        link: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=yuPjoC3jmPA',
            image: 'base64Test',
          },
        ],
      };
      const result = await service.updateContentFromId(content._id, {
        type: ContentType.Short,
        payload: updatePayload,
        castcleId: user.displayId,
      });
      expect((result.payload as ShortPayload).message).toEqual(
        updatePayload.message,
      );

      expect((result.payload as ShortPayload).link).toEqual(updatePayload.link);
      const postContent = await service.getContentFromId(content._id);
      expect((postContent.payload as ShortPayload).message).toEqual(
        updatePayload.message,
      );
      expect((postContent.payload as ShortPayload).link).toEqual(
        updatePayload.link,
      );
      const revisions = await service.getContentRevisions(postContent);
      expect(postContent.revisionCount).toEqual(revisions.length);
    });
    it('should update the content hashtag', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status #sompop #yo',
      };
      await service.updateContentFromId(hashtagContent._id, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      const hashtags = await service.hashtagService.getAll();
      const sompopTag = hashtags.find((ht) => ht.tag === 'sompop');
      expect(sompopTag).toBeDefined();
      expect(sompopTag.score).toEqual(1);
      const coolTag = hashtags.find((ht) => ht.tag === 'cool');
      expect(coolTag.score).toEqual(0);
      const yoTag = hashtags.find((ht) => ht.tag === 'yo');
      expect(yoTag.score).toEqual(1);
    });
  });
  describe('#deleteContentFromId()', () => {
    it('should set delete content flag to Delete', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status #cool #yo',
      };
      const toDeleteContent = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      await service.deleteContentFromId(toDeleteContent.id);
      const postDelete = await service.getContentFromId(toDeleteContent.id);
      expect(postDelete).toBeNull();
    });
    it('should be able to decrease hashtag Score ', async () => {
      await service.deleteContentFromId(hashtagContent._id);
      const hashtags = await service.hashtagService.getAll();
      expect(hashtags[0].score).toEqual(0);
      expect(hashtags[1].score).toEqual(0);
      expect(hashtags[2].score).toEqual(0);
    });
  });
  describe('#getContentsFromUser()', () => {
    it('should return Content[] from author', async () => {
      const shortPayload1: ShortPayload = {
        message: 'Order 1',
      };
      await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload1,
        castcleId: user.displayId,
      });
      const shortPayload2: ShortPayload = {
        message: 'Order 2',
      };
      await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId,
      });
      const contents = await service.getContentsFromUser(user.id);
      expect(contents.items[0].payload).toEqual(shortPayload2);
      expect(contents.items[1].payload).toEqual(shortPayload1);
      const contentsInverse = await service.getContentsFromUser(user.id, {
        sortBy: {
          field: 'updatedAt',
          type: SortDirection.ASC,
        },
      });
      expect(
        contentsInverse.items[contentsInverse.items.length - 2].payload,
      ).toEqual(shortPayload1);
      expect(
        contentsInverse.items[contentsInverse.items.length - 1].payload,
      ).toEqual(shortPayload2);
    });
  });
  describe('#likeContent()', () => {
    let content: Content;
    beforeAll(async () => {
      const shortPayload2: ShortPayload = {
        message: 'Test Like 2',
      };
      content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId,
      });
      await new service._feedItemModel({
        calledAt: new Date(),
        viewer: user.ownerAccount,
        content: content._id,
      }).save();
    });

    it('should update total like Count after call', async () => {
      const likeResult = await service.likeContent(content, user);
      expect(likeResult).toBeDefined();
      const engagement = await service._engagementModel
        .findById(likeResult._id)
        .exec();
      //console.log('newly engagement', engagement);
      expect(engagement.user).toEqual(user._id);
      const postContent = await service.getContentFromId(content._id);
      //console.log(postContent.engagements);
      expect(postContent.engagements['like']).toBeDefined();
      expect(postContent.engagements['like'].count).toEqual(1);
    });
    it('should if have double like should have the same amount of like', async () => {
      await service.likeContent(content, user);
      const postContent = await service.getContentFromId(content._id);
      expect(postContent.engagements['like']).toBeDefined();
      expect(postContent.engagements['like'].count).toEqual(1);
    });
    it('should showup in feedItem', async () => {
      const feedItems = await service._feedItemModel
        .find({
          content: content._id,
        })
        .populate('content')
        .exec();
      expect(feedItems.length > 0).toEqual(true);
      for (let i = 0; i < feedItems.length; i++)
        expect(feedItems[i].content.engagements['like'].count).toEqual(1);
    });
    describe('#unLikeContent()', () => {
      it('should update total like after call', async () => {
        await service.unLikeContent(content, user);
        const postContent = await service.getContentFromId(content._id);
        expect(postContent.engagements['like']).toBeDefined();
        expect(postContent.engagements['like'].count).toEqual(0);
      });
      it('should handle double unlike', async () => {
        await service.unLikeContent(content, user);
        const postContent = await service.getContentFromId(content._id);
        expect(postContent.engagements['like']).toBeDefined();
        expect(postContent.engagements['like'].count).toEqual(0);
      });
      it('should unlike on feedItems too', async () => {
        const feedItems = await service._feedItemModel
          .find({
            content: content._id,
          })
          .populate('content')
          .exec();
        expect(feedItems.length > 0).toEqual(true);
        for (let i = 0; i < feedItems.length; i++)
          expect(feedItems[i].content.engagements['like'].count).toEqual(0);
      });
    });
  });
  describe('#recastContent/#quoteContent', () => {
    const users: User[] = [];

    let contentA: Content;
    beforeAll(async () => {
      //create user  create content
      for (let i = 0; i < userInfo.length; i++) {
        const createAccResult = await authService.createAccount(
          userInfo[i].accountRequirement,
        );
        await authService.signupByEmail(
          createAccResult.accountDocument,
          userInfo[i].signupRequirement,
        );
        users[i] = await userService.getUserFromCredential(
          createAccResult.credentialDocument,
        );
      }
      //userA create a content
      contentA = await service.createContentFromUser(users[0], {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });
    describe('#recastContentFromUser()', () => {
      let contentB: Content;
      let contentC: Content;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        const resultC = await service.recastContentFromUser(contentB, users[2]);
        contentC = resultC.recastContent;
      });
      it('should create new content type as recast', () => {
        expect(contentB.isRecast).toEqual(true);
        expect(contentC.isRecast).toEqual(true);
        expect(contentB.originalPost).toBeDefined();
        expect(contentC.originalPost).toBeDefined();
      });
      it('should update engagement recast at original content', async () => {
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.recast.count).toEqual(2);
        const postContentB = await service.getContentFromId(contentB._id);
        expect(postContentB.engagements.recast.count).toEqual(0);
      });
      it('when we delete recast content it should delete engagement of original content', async () => {
        await service.deleteContentFromId(contentC._id);
        const postContentA = await service.getContentFromId(contentA._id);

        expect(postContentA.engagements.recast.count).toEqual(1);
      });
    });
    describe('#quoteContentFromUser()', () => {
      let contentB: Content;
      let contentC: Content;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        const resultC = await service.quoteContentFromUser(
          contentB,
          users[2],
          'this is good content',
        );
        contentC = resultC.quoteContent;
      });
      it('should create new content type as recast', async () => {
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.quote.count).toEqual(1);
      });
      it('when we delete recast content it should delete engagement of original content', async () => {
        await service.deleteContentFromId(contentC._id);
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.quote.count).toEqual(0);
      });
    });
    describe('Comment Features', () => {
      let contentA: Content;
      let userA: User;
      let rootComment: Comment;
      let replyComment: Comment;
      beforeAll(async () => {
        //console.log('before comment features');
        const account = await authService.getAccountFromEmail(
          userInfo[0].signupRequirement.email,
        );
        userA = await authService._userModel
          .findOne({ ownerAccount: account._id })
          .exec();
        contentA = await service.createContentFromUser(userA, {
          payload: {
            message: 'hi',
          } as ShortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        });
      });
      describe('#createCommentForContent()', () => {
        it('should be create a document in comment collection', async () => {
          //console.log('create Comment for content');
          rootComment = await service.createCommentForContent(user, contentA, {
            message: 'Hello #hello',
          });
          expect(contentA.engagements.comment.count).toEqual(0);
          const findResult = await service._commentModel
            .find({ targetRef: { $id: contentA._id, $ref: 'content' } })
            .exec();
          expect(findResult.length).toEqual(1);
          expect(findResult[0].message).toEqual(rootComment.message);
          expect(findResult[0].author._id).toEqual(rootComment.author._id);
          expect(findResult[0].revisionCount).toEqual(
            rootComment.revisionCount,
          );
          expect(findResult[0].type).toEqual(rootComment.type);
          expect(findResult[0].targetRef.$id).toEqual(
            rootComment.targetRef.oid,
          );
        });
        it('should increase engagement.comment of content', async () => {
          const postContent = await service.getContentFromId(contentA._id);
          expect(postContent.engagements.comment.count).toEqual(1);
        });
        it('should create hashtag', async () => {
          const hashtags = await service.hashtagService.getAll();
          const helloTag = hashtags.find((ht) => ht.tag === 'hello');
          expect(helloTag.score).toEqual(1);
        });
      });
      describe('#replyComment()', () => {
        it('should create a document in comment collection', async () => {
          ////console.log(createResult)
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.comment.count).toEqual(0);
          const replyResult = await service.replyComment(user, rootComment, {
            message: 'nice #baby',
          });
          const findResult = await service._commentModel
            .find({ targetRef: { $id: rootComment._id, $ref: 'comment' } })
            .exec();
          expect(findResult.length).toEqual(1);
          expect(findResult[0].message).toEqual(replyResult.message);
          expect(findResult[0].author._id).toEqual(replyResult.author._id);
          expect(findResult[0].revisionCount).toEqual(
            replyResult.revisionCount,
          );
          expect(findResult[0].type).toEqual(replyResult.type);
          expect(findResult[0].targetRef.$id).toEqual(
            replyResult.targetRef.oid,
          );
          replyComment = findResult[0];
        });
        it('should create hashtag ', async () => {
          const hashtags = await service.hashtagService.getAll();
          const babyTag = hashtags.find((ht) => ht.tag === 'baby');
          expect(babyTag.score).toEqual(1);
        });
        it('should increase engagement.comment of comment', async () => {
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.comment.count).toEqual(1);
        });
      });
      describe('#updateComment()', () => {
        it('should update the comment message', async () => {
          expect(rootComment.message).toEqual('Hello #hello');
          const postComment = await service.updateComment(rootComment, {
            message: 'cool',
          });
          expect(postComment.message).toEqual('cool');
          const postRootComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postRootComment.message).toEqual('cool');
        });
        it('should not effect the comment counter', async () => {
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.comment.count).toEqual(1);
        });
        it('should update comment score', async () => {
          const hashtags = await service.hashtagService.getAll();
          const helloTag = hashtags.find((ht) => ht.tag === 'hello');
          expect(helloTag.score).toEqual(0);
        });
      });
      describe('#likeComment()', () => {
        it('should update engagement.like of comment', async () => {
          await service.likeComment(user, rootComment);
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.like.count).toEqual(1);
        });
        it('should not effected by double like', async () => {
          await service.likeComment(user, rootComment);
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.like.count).toEqual(1);
        });
      });
      describe('#unlikeComment()', () => {
        it('should update engagement.like of comment', async () => {
          await service.unlikeComment(user, rootComment);
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.like.count).toEqual(0);
        });
        it('should not effected by double like', async () => {
          await service.unlikeComment(user, rootComment);
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.like.count).toEqual(0);
        });
      });
      describe('#deleteComment()', () => {
        it('should remove a reply from comment', async () => {
          const preComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(preComment.engagements.comment.count).toEqual(1);
          await service.deleteComment(replyComment);
          const postReply = await service._commentModel
            .findById(replyComment._id)
            .exec();
          expect(postReply.visibility).toEqual(EntityVisibility.Deleted);
          const comments = await commentService.getCommentsByContentId(
            user,
            contentA._id,
          );
          expect(comments.meta.resultCount).toEqual(1);
          expect(comments.payload[0].reply.length).toEqual(0);
          //expect reply engagement = 0
          const postComment = await service._commentModel
            .findById(rootComment._id)
            .exec();
          expect(postComment.engagements.comment.count).toEqual(0);
        });

        it('should remove a comment from content', async () => {
          await service.deleteComment(rootComment);
          const comments = await commentService.getCommentsByContentId(
            user,
            contentA._id,
          );
          expect(comments.meta.resultCount).toEqual(0);
        });
      });
    });
  });

  describe('#createContentsFromTweets', () => {
    const message = 'Sign Up Now 👉 https://www.castcle.com';
    const expectedMessage = 'Sign Up Now 👉 https://www.castcle.com';

    it('should not create any content', async () => {
      const contents = await service.createContentsFromAuthor(author, []);

      expect(contents).toEqual([]);
    });

    it('should create a short content from timeline', async () => {
      const contentDto = {
        type: ContentType.Short,
        payload: { message },
      } as SaveContentDto;
      const contents = await service.createContentsFromAuthor(author, [
        contentDto,
      ]);
      const content = contents?.[0];

      expect(contents.length).toEqual(1);
      expect(content.type).toEqual(ContentType.Short);
      expect(content.payload).toMatchObject({ message: expectedMessage });
    });
  });

  describe('#reportContent', () => {
    const reportingMessage = 'reporting message';
    let content: Content;

    beforeAll(async () => {
      content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: { message: 'report content test' },
        castcleId: user.displayId,
      });
    });

    it('should throw CONTENT_NOT_FOUND when content to report is not found', async () => {
      await expect(
        service.reportContent(user, null, reportingMessage),
      ).rejects.toThrow(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('should report content by sending email to Castcle admin', async () => {
      await service.reportContent(user, content, reportingMessage);

      const reportedContent = await service.getContentFromId(content._id);
      const engagements = await service._engagementModel.find({
        user: user._id,
        targetRef: { $ref: 'content', $id: content._id },
      });

      const reportedItem = reportedContent.toContentPayloadItem(engagements);

      expect((service as any).logger.log).toBeCalled();
      expect((service as any).transporter.sendMail).toBeCalled();
      expect(reportedItem.participate.reported).toBeTruthy();
    });
  });

  describe('#deleteContentFromOriginalAndAuthor()', () => {
    let contentA: Content;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(2, 0, {
        userService: userService,
        accountService: authService,
      });

      //userA create a content
      contentA = await service.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });

    it('should set delete content successful', async () => {
      const resultB = await service.recastContentFromUser(
        contentA,
        mockUsers[1].user,
      );
      const contentB = resultB.recastContent;
      await service.deleteRecastContentFromOriginalAndAuthor(
        contentA.id,
        mockUsers[1].user.id,
      );
      const postDelete = await service.getContentFromId(contentB.id);
      expect(postDelete).toBeNull();
    });
  });

  describe('#convertContentsToContentsResponse', () => {
    let contents: Content[];

    beforeAll(async () => {
      const contentDto = {
        type: ContentType.Short,
        payload: { message: 'message' },
      } as SaveContentDto;

      contents = await service.createContentsFromAuthor(author, [contentDto]);
    });

    it('should return ContentsResponse if requester is member', async () => {
      const contentsResponse = await service.convertContentsToContentsResponse(
        user,
        contents,
        true,
      );

      expect(contentsResponse.includes.users.length).toEqual(1);
      expect(contentsResponse.payload.length).toEqual(1);
      expect(contentsResponse.meta.resultCount).toEqual(1);
    });

    it('should return ContentsResponse if requester is guest (null)', async () => {
      const contentsResponse = await service.convertContentsToContentsResponse(
        null,
        contents,
        true,
      );

      expect(contentsResponse.includes.users.length).toEqual(1);
      expect(contentsResponse.payload.length).toEqual(1);
      expect(contentsResponse.meta.resultCount).toEqual(1);
    });
  });

  describe('#deleteContentFromOriginalAndAuthor', () => {
    let contentA: Content;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(2, 0, {
        userService: userService,
        accountService: authService,
      });

      //userA create a content
      contentA = await service.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });

    it('should set delete content successful', async () => {
      const resultB = await service.recastContentFromUser(
        contentA,
        mockUsers[1].user,
      );
      const contentB = resultB.recastContent;
      await service.deleteRecastContentFromOriginalAndAuthor(
        contentA.id,
        mockUsers[1].user.id,
      );
      const postDelete = await service.getContentFromId(contentB.id);
      expect(postDelete).toBeNull();
    });
  });

  describe('#getContentFromOriginalPost', () => {
    let contentA: Content;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(5, 0, {
        userService: userService,
        accountService: authService,
      });

      //userA create a content
      contentA = await service.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      await service.recastContentFromUser(contentA, mockUsers[1].user);
      await service.recastContentFromUser(contentA, mockUsers[2].user);
      await service.recastContentFromUser(contentA, mockUsers[3].user);
      await service.recastContentFromUser(contentA, mockUsers[4].user);
    });

    it('should get all recast content', async () => {
      const result = await service.getContentFromOriginalPost(contentA.id, 100);
      expect(result.items).toBeDefined();
      expect(result.items.length).toEqual(4);
      expect(result.total).toEqual(4);
    });

    it('should get recast content with untilId', async () => {
      const allRecast = await service.getContentFromOriginalPost(
        contentA.id,
        100,
      );
      const result = await service.getContentFromOriginalPost(
        contentA.id,
        100,
        null,
        allRecast.items[1].author.id,
      );

      const foundData = result.items.find(
        (x) =>
          x.author.id.toString() === allRecast.items[2].author.id.toString(),
      );
      const findMissing = result.items.find(
        (x) =>
          x.author.id.toString() === allRecast.items[0].author.id.toString(),
      );
      expect(result.items).toBeDefined();
      expect(result.items.length).toEqual(2);
      expect(result.total).toEqual(4);
      expect(foundData).toBeDefined();
      expect(findMissing).toBeUndefined();
    });

    it('should get recast content with sinceId', async () => {
      const allRecast = await service.getContentFromOriginalPost(
        contentA.id,
        100,
      );
      const result = await service.getContentFromOriginalPost(
        contentA.id,
        100,
        allRecast.items[2].author.id,
        null,
      );

      const findMissing = result.items.find(
        (x) =>
          x.author.id.toString() === allRecast.items[2].author.id.toString(),
      );
      const foundData = result.items.find(
        (x) =>
          x.author.id.toString() === allRecast.items[0].author.id.toString(),
      );
      expect(result.items).toBeDefined();
      expect(result.items.length).toEqual(2);
      expect(result.total).toEqual(4);
      expect(foundData).toBeDefined();
      expect(findMissing).toBeUndefined();
    });
  });

  describe('#getEngagementFromUser', () => {
    let content: Content | Content[];
    let mockUsers: MockUserDetail[];
    let engagement: any;
    beforeAll(async () => {
      mockUsers = await generateMockUsers(2, 0, {
        userService: userService,
        accountService: authService,
      });

      content = await service.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });
      await new service._engagementModel({
        type: 'like',
        user: mockUsers[1].user._id,
        account: mockUsers[1].user.ownerAccount,
        targetRef: {
          $ref: 'content',
          $id: content.id,
        },
        visibility: EntityVisibility.Publish,
      }).save();
    });

    it('should get engagement with userId', async () => {
      engagement = await service.getEngagementFromUser(
        mockUsers[1].user._id,
        null,
        null,
        100,
      );

      expect(engagement.total).toEqual(1);
      expect(engagement.items).toHaveLength(1);
      expect(String(engagement.items[0].user)).toBe(
        String(mockUsers[1].user._id),
      );
    });

    it('should get content with $in _id exists.', async () => {
      content = await service.getContentAllFromId(engagement.items);
      expect(String(mockUsers[0].user._id)).toBe(String(content[0].author.id));
      expect(content).toHaveLength(1);
    });

    it('should create response user liked is correct.', async () => {
      const response = await service.convertContentsToContentsResponse(
        mockUsers[1].user,
        content as Content[],
        true,
        engagement.items,
      );
      expect(response.payload).toHaveLength(1);
      expect(String(response.payload[0].authorId)).toBe(
        String(mockUsers[0].user._id),
      );
      expect(String(response.payload[0].id)).toBe(String(content[0].id));
      expect(response.payload[0].message).toBe(content[0].payload.message);
    });

    afterAll(() => {
      service._userModel.deleteMany({});
      service._contentModel.deleteMany({});
      service._engagementModel.deleteMany({});
    });
  });
});
