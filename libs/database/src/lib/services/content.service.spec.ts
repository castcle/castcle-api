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
import { ContentService } from './content.service';
import { env } from '../environment';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { MongooseForFeatures, MongooseAsyncFeatures } from '../database.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ContentDocument } from '../schemas/content.schema';
import { ContentType, DEFAULT_QUERY_OPTIONS, EntityVisibility } from '../dtos';
import { CommentDocument, UserDocument } from '../schemas';
import { Author, SaveContentDto, ShortPayload } from '../dtos/content.dto';
import { EngagementDocument } from '../schemas/engagement.schema';
import { BullModule } from '@nestjs/bull';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { UserVerified } from '../schemas/user.schema';
import { FeedItemDocument } from '../schemas/feedItem.schema';
import { HashtagService } from './hashtag.service';

jest.mock('@castcle-api/logger');
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn() })
}));

const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: { host: '0.0.0.0', port: 6380 }
});

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      return {
        ...options,
        uri: mongod.getUri()
      };
    }
  });

describe('ContentService', () => {
  let service: ContentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: UserDocument;
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
          platform: 'iOs'
        },
        languagesPreferences: ['th', 'th']
      },
      signupRequirement: {
        displayId: 'npop',
        displayName: 'npop',
        email: 'sompop.k@gmail.com',
        password: '2@HelloWorld'
      }
    },
    {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone5678',
        header: {
          platform: 'iOs'
        },
        languagesPreferences: ['th', 'th']
      },
      signupRequirement: {
        displayId: 'sompop',
        displayName: 'sompop',
        email: 'sompop.ku@gmail.com',
        password: '2@HelloWorld'
      }
    },
    {
      accountRequirement: {
        device: 'iphone',
        deviceUUID: 'iphone1234',
        header: {
          platform: 'iOs'
        },
        languagesPreferences: ['th', 'th']
      },
      signupRequirement: {
        displayId: 'kuku',
        displayName: 'kuku',
        email: 'sompop.kuku@gmail.com',
        password: '2@HelloWorld'
      }
    }
  ];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };
  let hashtagContent: ContentDocument;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        env.DB_TEST_IN_DB
          ? MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS)
          : rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull
      ],
      providers: [
        AuthenticationService,
        ContentService,
        HashtagService,
        UserProducer,
        UserService
      ]
    }).compile();
    service = module.get<ContentService>(ContentService);
    userService = module.get<UserService>(UserService);
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
    user = await userService.getUserFromCredential(result.credentialDocument);
    author = {
      id: user.id,
      type: 'page',
      castcleId: 'castcleId',
      displayName: 'Castcle',
      verified: { email: true, mobile: true, official: true, social: true },
      followed: true,
      avatar: null
    };
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await mongod?.stop();
  });

  describe('#createContentFromUser', () => {
    it('should create short content instance in db with author as user', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId
      });
      expect((content.payload as ShortPayload).message).toEqual(
        shortPayload.message
      );
      expect(content.type).toEqual(ContentType.Short);
      expect(content.author.id).toEqual(user._id);
      expect(content.revisionCount).toEqual(1);
      expect(content.toContentPayload().author.verified).toEqual({
        email: false,
        mobile: false,
        official: false,
        social: false
      } as UserVerified);
    });
    it('should create a hashtag stat', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status #cool #yo'
      };
      hashtagContent = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId
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
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId
      });
      const revisionCount = content.revisionCount;
      expect(content.revisionCount).toEqual(1);
      const updatePayload: ShortPayload = {
        message: 'this is test status2',
        link: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=yuPjoC3jmPA',
            image: 'base64Test'
          }
        ]
      };
      const result = await service.updateContentFromId(content._id, {
        type: ContentType.Short,
        payload: updatePayload,
        castcleId: user.displayId
      });
      expect((result.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );

      expect((result.payload as ShortPayload).link).toEqual(updatePayload.link);
      const postContent = await service.getContentFromId(content._id);
      expect((postContent.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );
      expect((postContent.payload as ShortPayload).link).toEqual(
        updatePayload.link
      );
      const revisions = await service.getContentRevisions(postContent);
      expect(postContent.revisionCount).toEqual(revisions.length);
    });
    it('should update the content hashtag', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status #sompop #yo'
      };
      await service.updateContentFromId(hashtagContent._id, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId
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
        message: 'this is test status #cool #yo'
      };
      const toDeleteContent = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId
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
    it('should return ContentDocument[] from author', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload1: ShortPayload = {
        message: 'Order 1'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload1,
        castcleId: user.displayId
      });
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload2: ShortPayload = {
        message: 'Order 2'
      };
      const content2 = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId
      });
      const contents = await service.getContentsFromUser(user);
      expect(contents.items[0].payload).toEqual(shortPayload2);
      expect(contents.items[1].payload).toEqual(shortPayload1);
      const contentsInverse = await service.getContentsFromUser(user, {
        sortBy: {
          field: 'updatedAt',
          type: 'asc'
        }
      });
      expect(
        contentsInverse.items[contentsInverse.items.length - 2].payload
      ).toEqual(shortPayload1);
      expect(
        contentsInverse.items[contentsInverse.items.length - 1].payload
      ).toEqual(shortPayload2);
    });
  });
  describe('#likeContent()', () => {
    let content: ContentDocument;
    let feedItems: FeedItemDocument[];
    beforeAll(async () => {
      const shortPayload2: ShortPayload = {
        message: 'Test Like 2'
      };
      content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId
      });
      feedItems = await service.createFeedItemFromAuthorToEveryone(content);
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
      const likeResult = await service.likeContent(content, user);
      const postContent = await service.getContentFromId(content._id);
      expect(postContent.engagements['like']).toBeDefined();
      expect(postContent.engagements['like'].count).toEqual(1);
    });
    it('should showup in feedItem', async () => {
      const feedItems = await service._feedItemModel
        .find({
          'content.id': content._id
        })
        .exec();
      expect(feedItems.length > 0).toEqual(true);
      for (let i = 0; i < feedItems.length; i++)
        expect(feedItems[i].content.liked.count).toEqual(1);
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
            'content.id': content._id
          })
          .exec();
        expect(feedItems.length > 0).toEqual(true);
        for (let i = 0; i < feedItems.length; i++)
          expect(feedItems[i].content.liked.count).toEqual(0);
      });
    });
  });
  describe('#recastContent/#quoteContent', () => {
    const users: UserDocument[] = [];

    let contentA: ContentDocument;
    beforeAll(async () => {
      //create user  create content
      for (let i = 0; i < userInfo.length; i++) {
        const createAccResult = await authService.createAccount(
          userInfo[i].accountRequirement
        );
        const accountActivation = await authService.signupByEmail(
          createAccResult.accountDocument,
          userInfo[i].signupRequirement
        );
        users[i] = await userService.getUserFromCredential(
          createAccResult.credentialDocument
        );
      }
      //userA create a content
      contentA = await service.createContentFromUser(users[0], {
        payload: {
          message: 'hello world'
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId
      });
    });
    describe('#recastContentFromUser()', () => {
      let contentB: ContentDocument;
      let engagementB: EngagementDocument;
      let contentC: ContentDocument;
      let engagementC: EngagementDocument;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        engagementB = resultB.engagement;
        const resultC = await service.recastContentFromUser(contentB, users[2]);
        contentC = resultC.recastContent;
        engagementC = resultC.engagement;
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
      let contentB: ContentDocument;
      let engagementB: EngagementDocument;
      let contentC: ContentDocument;
      let engagementC: EngagementDocument;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        engagementB = resultB.engagement;
        const resultC = await service.quoteContentFromUser(
          contentB,
          users[2],
          'this is good content'
        );
        contentC = resultC.quoteContent;
        engagementC = resultC.engagement;
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
      let contentA: ContentDocument;
      let userA: UserDocument;
      let rootComment: CommentDocument;
      let replyComment: CommentDocument;
      beforeAll(async () => {
        //console.log('before comment features');
        const account = await authService.getAccountFromEmail(
          userInfo[0].signupRequirement.email
        );
        userA = await authService._userModel
          .findOne({ ownerAccount: account._id })
          .exec();
        contentA = await service.createContentFromUser(userA, {
          payload: {
            message: 'hi'
          } as ShortPayload,
          type: ContentType.Short,
          castcleId: user.displayId
        });
      });
      describe('#createCommentForContent()', () => {
        it('should be create a document in comment collection', async () => {
          //console.log('create Comment for content');
          rootComment = await service.createCommentForContent(user, contentA, {
            message: 'Hello #hello'
          });
          expect(contentA.engagements.comment.count).toEqual(0);
          const findResult = await service._commentModel
            .find({ targetRef: { $id: contentA._id, $ref: 'content' } })
            .exec();
          expect(findResult.length).toEqual(1);
          expect(findResult[0].message).toEqual(rootComment.message);
          expect(findResult[0].author._id).toEqual(rootComment.author._id);
          expect(findResult[0].revisionCount).toEqual(
            rootComment.revisionCount
          );
          expect(findResult[0].type).toEqual(rootComment.type);
          expect(findResult[0].targetRef.$id).toEqual(
            rootComment.targetRef.oid
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
            message: 'nice #baby'
          });
          const findResult = await service._commentModel
            .find({ targetRef: { $id: rootComment._id, $ref: 'comment' } })
            .exec();
          expect(findResult.length).toEqual(1);
          expect(findResult[0].message).toEqual(replyResult.message);
          expect(findResult[0].author._id).toEqual(replyResult.author._id);
          expect(findResult[0].revisionCount).toEqual(
            replyResult.revisionCount
          );
          expect(findResult[0].type).toEqual(replyResult.type);
          expect(findResult[0].targetRef.$id).toEqual(
            replyResult.targetRef.oid
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
            message: 'cool'
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
      describe('#getCommentsFromContent()', () => {
        it('should get comment and reply from content', async () => {
          const comments = await service.getCommentsFromContent(
            contentA,
            DEFAULT_QUERY_OPTIONS
          );
          expect(comments.meta.resultCount).toEqual(1);
          expect(comments.payload[0].reply.length).toEqual(1);
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
          const result = await service.deleteComment(replyComment);
          const postReply = await service._commentModel
            .findById(replyComment._id)
            .exec();
          expect(postReply.visibility).toEqual(EntityVisibility.Deleted);
          const comments = await service.getCommentsFromContent(
            contentA,
            DEFAULT_QUERY_OPTIONS
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
          const result = await service.deleteComment(rootComment);
          const comments = await service.getCommentsFromContent(
            contentA,
            DEFAULT_QUERY_OPTIONS
          );
          expect(comments.meta.resultCount).toEqual(0);
        });
      });
    });
  });

  describe('#createContentsFromTweets', () => {
    const message = 'Sign Up Now 👉 https://t.co/tcMAgbWlxI';
    const contentDto = {
      type: 'short',
      payload: { message }
    } as SaveContentDto;

    it('should not create any content', async () => {
      const contents = await service.createContentsFromAuthor(author, []);

      expect(contents).toBeUndefined();
    });

    it('should create a short content from timeline', async () => {
      const contents = await service.createContentsFromAuthor(author, [
        contentDto
      ]);
      const content = contents?.[0];

      expect(contents.length).toEqual(1);
      expect(content.type).toEqual(ContentType.Short);
      expect(content.payload).toEqual({ message });
    });
  });

  describe('#reportContent', () => {
    const reportingMessage = 'reporting message';
    let content: ContentDocument;

    beforeAll(async () => {
      content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: { message: 'report content test' },
        castcleId: user.displayId
      });
    });

    it('should throw CONTENT_NOT_FOUND when content to report is not found', async () => {
      await expect(
        service.reportContent(user, null, reportingMessage)
      ).rejects.toMatchObject({ response: { code: '5003' } });
    });

    it('should report content by sending email to Castcle admin', async () => {
      jest
        .spyOn((service as any).transporter, 'sendMail')
        .mockReturnValueOnce({ messageId: 1 });

      await service.reportContent(user, content, reportingMessage);

      const reportedContent = await service.getContentFromId(content._id);
      const engagements = await service._engagementModel.find({
        user: user._id,
        targetRef: { $ref: 'content', $id: content._id }
      });

      const reportedItem = reportedContent.toContentPayloadItem(engagements);

      expect((service as any).logger.log).toBeCalled();
      expect((service as any).transporter.sendMail).toBeCalled();
      expect(reportedItem.participate.reported).toBeTruthy();
    });
  });
});
