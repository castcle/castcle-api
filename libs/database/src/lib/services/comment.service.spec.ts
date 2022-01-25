import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ContentType } from '../dtos';
import { CommentDocument, ContentDocument, UserDocument } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('ContentService', () => {
  let mongod: MongoMemoryServer;
  let service: CommentService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let comment: CommentDocument;
  let content: ContentDocument;
  let user: UserDocument;

  const fakeBull = BullModule.registerQueue({
    name: TopicName.Users,
    redis: { host: '0.0.0.0', port: 6380 },
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => {
            mongod = await MongoMemoryServer.create();

            return { uri: mongod.getUri() };
          },
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull,
      ],
      providers: [
        AuthenticationService,
        CommentService,
        ContentService,
        HashtagService,
        UserProducer,
        UserService,
      ],
    }).compile();

    authService = module.get(AuthenticationService);
    contentService = module.get(ContentService);
    service = module.get(CommentService);
    userService = module.get(UserService);

    const result = await authService.createAccount({
      deviceUUID: 'test-uuid',
      languagesPreferences: ['th', 'th'],
      header: { platform: 'ios' },
      device: 'test',
    });

    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });

    user = await userService.getUserFromCredential(result.credentialDocument);
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'hi' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });

    comment = await contentService.createCommentForContent(user, content, {
      message: 'Hello #hello',
    });
  });

  afterAll(() => {
    mongod.stop();
  });

  describe('#convertCommentToCommentResponse', () => {
    it('should return comment in type of CommentResponse', async () => {
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: false }
      );

      expect(response.author.followed).toBeUndefined();
      expect(response.metrics.likeCount).toEqual(
        comment.engagements.like.count
      );
    });

    it('should return comment in type of CommentResponse with relationships', async () => {
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: true }
      );

      expect(response.author.followed).toBeDefined();
    });
  });

  describe('#getCommentsByContentId()', () => {
    it('should get comment and reply from content', async () => {
      const comments = await service.getCommentsByContentId(user, content._id);

      expect(comments.meta.resultCount).toEqual(1);
    });
  });
});
