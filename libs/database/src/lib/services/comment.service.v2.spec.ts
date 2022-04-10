import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ContentType } from '../dtos';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { QueueName } from '../models';
import { Comment, Content } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentServiceV2 } from './comment.service.v2';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('CommentServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: CommentServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let comment: Comment;
  let content: Content;
  let mocksUsers: MockUserDetail[];

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
        AuthenticationService,
        CommentServiceV2,
        ContentService,
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

    authService = app.get(AuthenticationService);
    contentService = app.get(ContentService);
    service = app.get(CommentServiceV2);
    userService = app.get(UserService);

    mocksUsers = await generateMockUsers(2, 0, {
      userService: userService,
      accountService: authService,
    });

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'hi v2' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });

    comment = await contentService.createCommentForContent(user, content, {
      message: 'Hello #hello v2',
    });

    await contentService.replyComment(user, comment, {
      message: 'nice #baby',
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#convertCommentToCommentResponse', () => {
    it('should return comment in type of CommentResponse', async () => {
      const user = mocksUsers[0].user;
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: false }
      );

      expect(response.includes.users[0].followed).toBeUndefined();
      expect(response.payload.metrics.likeCount).toEqual(
        comment.engagements.like.count
      );
    });

    it('should return comment in type of CommentResponse with relationships', async () => {
      const user = mocksUsers[0].user;
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: true }
      );
      expect(response.includes.users[0].followed).toBeDefined();
    });
  });

  describe('#getCommentsByContentId()', () => {
    it('should get comment and reply from content', async () => {
      const user = mocksUsers[0].user;
      const commentsResult = await service.getCommentsByContentId(
        user,
        content._id,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );

      expect(commentsResult.meta.resultCount).toEqual(1);
    });
  });

  describe('#getReplyCommentsByCommentId()', () => {
    it('should get reply comment from content', async () => {
      const user = mocksUsers[0].user;
      const replyComments = await service.getReplyCommentsByCommentId(
        user,
        comment._id,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );
      expect(replyComments.meta.resultCount).toEqual(1);
    });
  });

  describe('#deleteComment()', () => {
    it('should remove a reply from comment', async () => {
      const user = mocksUsers[0].user;
      const preComment = await service.commentModel
        .findById(comment._id)
        .exec();
      expect(preComment.engagements.comment.count).toEqual(1);
      await service.deleteComment(comment);
      const postReply = await service.commentModel.findById(comment._id).exec();
      expect(postReply).toBeNull();
      const comments = await service.getCommentsByContentId(user, content._id, {
        maxResults: 5,
        hasRelationshipExpansion: false,
      });
      expect(comments.meta.resultCount).toEqual(0);
    });
  });
});
