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

import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ContentType, QueueName } from '../models';
import { Comment, Content, User } from '../schemas';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';

describe('CommentService', () => {
  let moduleRef: TestingModule;
  let service: CommentService;
  let contentService: ContentService;
  let comment: Comment;
  let content: Content;
  let user: User;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CacheModule.register(),
        CastcleMongooseModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        CommentService,
        ContentService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    });

    contentService = moduleRef.get(ContentService);
    service = moduleRef.get(CommentService);

    user = (await moduleRef.createUser()).user;
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
    return moduleRef.close();
  });

  describe('#convertCommentToCommentResponse', () => {
    it('should return comment in type of CommentResponse', async () => {
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: false },
      );

      expect(response.author.followed).toBeUndefined();
      expect(response.metrics.likeCount).toEqual(
        comment.engagements.like.count,
      );
    });

    it('should return comment in type of CommentResponse with relationships', async () => {
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: true },
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
