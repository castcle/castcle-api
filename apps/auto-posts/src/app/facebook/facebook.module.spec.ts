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
  QueueName,
  SocialProvider,
  SocialSync,
  User,
  UserType,
} from '@castcle-api/database';
import { Downloader, Image } from '@castcle-api/utils/aws';
import { getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyRequest } from 'fastify';
import { getLinkPreview } from 'link-preview-js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { ValidateWebhookQuery } from '../youtube/dto';
import { FeedEntryChange, SubscriptionEntry } from './dto';
import { FacebookController } from './facebook.controller';
import { FacebookModule } from './facebook.module';

describe('FacebookController', () => {
  let mongo: MongoMemoryReplSet;
  let moduleRef: TestingModule;
  let controller: FacebookController;
  let downloader: Downloader;
  let logger: Logger;

  const socialId = {
    invalidAuthorId: 'invalid-author-id',
    invalid: 'invalid-social-id',
    valid: 'valid-social-id',
  };
  const user = {
    _id: Types.ObjectId(),
    ownerAccount: Types.ObjectId(),
    displayName: 'Tester',
    displayId: 'tester',
    type: UserType.PEOPLE,
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create();

    moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), FacebookModule],
    })
      .overrideProvider(getQueueToken(QueueName.CONTENT))
      .useValue({ add: jest.fn() })
      .compile();

    controller = moduleRef.get(FacebookController);
    downloader = moduleRef.get(Downloader);
    logger = (controller as any).logger;

    jest
      .spyOn(Image, 'upload')
      .mockResolvedValue(new Image({ original: 'uploaded-image-url' }));

    jest
      .spyOn(downloader, 'getImageFromUrl')
      .mockResolvedValue('image-base-64');

    const userModel = moduleRef.get<Model<User>>(getModelToken('User'));
    const socialSyncModel = moduleRef.get<Model<SocialSync>>(
      getModelToken('SocialSync'),
    );

    await userModel.create(user);
    await socialSyncModel.create([
      {
        active: true,
        autoPost: true,
        socialId: socialId.invalidAuthorId,
        provider: SocialProvider.Facebook,
        user: Types.ObjectId(),
      },
      {
        active: true,
        autoPost: true,
        socialId: socialId.valid,
        provider: SocialProvider.Facebook,
        user: user._id,
      },
    ]);
  });

  beforeEach(() => {
    (logger.log as unknown as jest.Mock).mockClear();
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  });

  describe('validateWebhook', () => {
    it('should return not challenge when verify token mismatched', () => {
      expect(
        controller.validateWebhook(
          {
            'hub.verify_token': 'invalid-verify-token',
            'hub.challenge': 'challenge',
          } as ValidateWebhookQuery,
          { headers: {} } as FastifyRequest,
        ),
      ).toEqual(undefined);
    });

    it('should return challenge when verify token matched', () => {
      expect(
        controller.validateWebhook(
          {
            'hub.verify_token': undefined,
            'hub.challenge': 'challenge',
          } as ValidateWebhookQuery,
          { headers: {} } as FastifyRequest,
        ),
      ).toEqual('challenge');
    });
  });

  describe('handleWebhook', () => {
    it('should not create any content when social ID does not match', async () => {
      const post = [
        { id: socialId.invalid },
      ] as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.error).lastCalledWith(
        `facebook-${socialId.invalid}`,
        'handleWebhook:sync-account-not-found',
      );
    });

    it('should not create any content when author from social ID does not exist', async () => {
      const post = [
        { id: socialId.invalidAuthorId },
      ] as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).rejects.toThrow();
    });

    it('should not create any content when there is no change', async () => {
      const post = [
        { id: socialId.valid },
      ] as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.error).lastCalledWith(
        `author-${user._id}`,
        `handleWebhook:no-change`,
      );
    });

    it('should not create any content when verb !== add', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161222,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                message: 'status post',
                post_id: '100776219104570_137039418811583',
                created_time: 1644917973,
                item: 'status',
                published: 1,
                verb: 'edited',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.error).lastCalledWith(
        `postId: ${post[0].changes[0].value.post_id}`,
        'handleWebhook:verb-mismatched',
      );
    });

    it('should not create any content when item !== photo|status|video', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161222,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                message: 'status post',
                post_id: '100776219104570_137039418811583',
                created_time: 1644917973,
                item: 'reaction',
                parent_id: '103289818986235_113129651335585',
                reaction_type: 'like',
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.error).lastCalledWith(
        `postId: ${post[0].changes[0].value.post_id}`,
        'handleWebhook:item-mismatched',
      );
    });

    it('should create short content from status post', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161222,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                message: 'status post',
                post_id: '100776219104570_137039418811583',
                created_time: 1644917973,
                item: 'status',
                published: 1,
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).lastCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"short"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create long content from long status post', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161222,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                message: 'long status post'.repeat(100),
                post_id: '100776219104570_137039418811583',
                created_time: 1644917973,
                item: 'status',
                published: 1,
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"long"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create video content from video post', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161273,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                link: 'https://video.fbkk2-7.fna.fbcdn.net/v/t42.1790-2/273809444_936159920599188_4282244513771915533_n.mp4?_nc_cat=106&ccb=1-5&_nc_sid=985c63&efg=eyJybHIiOjMwMCwicmxhIjo1MTIsInZlbmNvZGVfdGFnIjoic3ZlX3NkIn0%3D&_nc_eui2=AeFTL9SYFKMzKbfQaxJhw-a6-1jP4_YnDYf7WM_j9icNhx-ZFlhcMhbaoDfiNAej1Y5Oe-aTRENKLhaGJDPpOAMJ&_nc_ohc=pLhou-DfvQcAX9lNBRj&rl=300&vabr=92&_nc_ht=video.fbkk2-7.fna&oh=00_AT8KofG7zmU4dTXMFeaTtJpUp8l7oW3cgH1t2Lgt8Xh5Pw&oe=620F54BF',
                message: 'video post',
                post_id: '100776219104570_137039562144902',
                created_time: 1644918035,
                item: 'video',
                published: 1,
                verb: 'add',
                video_id: '479160660427787',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).toBeCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"video"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create image content from photo post', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161337,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                link: 'https://scontent.fbkk2-6.fna.fbcdn.net/v/t39.30808-6/274022943_137040375478154_7737513631518992007_n.jpg?_nc_cat=104&ccb=1-5&_nc_sid=8024bb&_nc_eui2=AeH-__numBYmlf6-UEvBlwIXLOSBi2m92vcs5IGLab3a977YBbBlMf9S1HX_wx8wi9HINZ1wqF79iT9TqCNLIOAx&_nc_ohc=z7zHiGMAGlgAX88Vt3E&_nc_ht=scontent.fbkk2-6.fna&oh=00_AT-wVlMYbeghu0_K4NObctkGE3Bu3aq-Zxe9YaEZYXL80A&oe=62145C41',
                post_id: '100776219104570_137040402144818',
                created_time: 1644918176,
                item: 'photo',
                photo_id: '137040378811487',
                published: 1,
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"image"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create short content from photo post with message', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161337,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                link: 'https://scontent.fbkk2-6.fna.fbcdn.net/v/t39.30808-6/274022943_137040375478154_7737513631518992007_n.jpg?_nc_cat=104&ccb=1-5&_nc_sid=8024bb&_nc_eui2=AeH-__numBYmlf6-UEvBlwIXLOSBi2m92vcs5IGLab3a977YBbBlMf9S1HX_wx8wi9HINZ1wqF79iT9TqCNLIOAx&_nc_ohc=z7zHiGMAGlgAX88Vt3E&_nc_ht=scontent.fbkk2-6.fna&oh=00_AT-wVlMYbeghu0_K4NObctkGE3Bu3aq-Zxe9YaEZYXL80A&oe=62145C41',
                message: 'photo post',
                post_id: '100776219104570_137040402144818',
                created_time: 1644918176,
                item: 'photo',
                photo_id: '137040378811487',
                published: 1,
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).lastCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"short"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create short content from multiple photos post', async () => {
      const post = [
        {
          id: socialId.valid,
          time: 1645161386,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                message: 'multiple photos post',
                photos: [
                  'https://scontent.fbkk2-8.fna.fbcdn.net/v/t39.30808-6/274059624_137041108811414_1251537345178093098_n.jpg?_nc_cat=103&ccb=1-5&_nc_sid=8024bb&_nc_eui2=AeHQL7_kSFL2ZsMylhe153UUfHmO1WzSWSJ8eY7VbNJZIh14sCcgTeOaPgarecOzvqacOQgmvIkXPo4vS4oZMaKk&_nc_ohc=XY1WW2jzvEYAX_a0KX5&_nc_ht=scontent.fbkk2-8.fna&oh=00_AT9UdilGwfHIvIIA5UH4WQuE05iwAgQdr8DOxVjJneS8jQ&oe=621385D2',
                  'https://scontent.fbkk2-3.fna.fbcdn.net/v/t39.30808-6/273997843_137041132144745_4165507432864248197_n.jpg?_nc_cat=109&ccb=1-5&_nc_sid=8024bb&_nc_eui2=AeEVfElnFlMk2Zx2yt5OzUAIGkXT4IoQ7hcaRdPgihDuF7nD8-fid6uDkVoT0de-bk1ZHp_78cEVXQRtARpcU2hT&_nc_ohc=-prvoMAd230AX8mlbnF&_nc_ht=scontent.fbkk2-3.fna&oh=00_AT_o8CgR27v1gjw3xRqP8YGBgLr-rNudRrpJBQL4EHND7A&oe=62149E8E',
                  'https://scontent.fbkk2-4.fna.fbcdn.net/v/t39.30808-6/274029322_137041172144741_2571796191053952485_n.jpg?_nc_cat=101&ccb=1-5&_nc_sid=8024bb&_nc_eui2=AeFyRPtU6BLf0rGUN1TVwrR_4iu2YqvrI03iK7Ziq-sjTUSyBbuap-5BmCWvv50E0R_jnsBvL5UqY57cYpVwNgaS&_nc_ohc=F6OMwXRaikIAX-1BBGn&_nc_ht=scontent.fbkk2-4.fna&oh=00_AT9iWQSC1JLpQD-szcdH3UVANgUoAkH7R7iC_LvWzhZzQw&oe=621380AD',
                ],
                post_id: '100776219104570_137041188811406',
                created_time: 1644918472,
                item: 'status',
                published: 1,
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).lastCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"short"`),
        'handleWebhook:contents-created',
      );
    });

    it('should create short content from facebook share', async () => {
      (getLinkPreview as jest.Mock).mockResolvedValueOnce({
        url: 'https://www.facebook.com/permalink.php?story_fbid=139572695224922&id=100776219104570',
        title: 'Test',
        description: 'Facebook Share',
        mediaType: 'website',
        images: [
          'https://scontent.fbkk12-4.fna.fbcdn.net/v/t39.30808-1/257382132_100776269104565_5345001410806291244_n.png?_nc_cat=110&ccb=1-5&_nc_sid=baafbc&_nc_ohc=VlkK08pa4vkAX8D61gA&_nc_ht=scontent.fbkk12-4.fna&oh=00_AT_0Wvk5Tmj-3Gmo6b7cJ8uFgluujDHro9oBiPlXsnqGnA&oe=625185C0',
        ],
      });

      const post = [
        {
          id: socialId.valid,
          time: 1649148511,
          changes: [
            {
              value: {
                from: { id: socialId.valid, name: 'Castcle' },
                link: '/permalink.php?story_fbid=139572695224922&id=100776219104570',
                message: 'Facebook Share',
                post_id: '100776219104570_150101544172037',
                created_time: 1649148508,
                item: 'share',
                published: 1,
                share_id: '150101547505370',
                verb: 'add',
              },
              field: 'feed',
            },
          ],
        },
      ] as unknown as SubscriptionEntry<FeedEntryChange>[];

      await expect(controller.handleWebhook(post)).resolves.not.toThrow();
      expect(logger.log).lastCalledWith(
        expect.stringContaining(post[0].changes[0].value.message),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(`"type":"short"`),
        'handleWebhook:contents-created',
      );
      expect(logger.log).lastCalledWith(
        expect.stringContaining(
          JSON.stringify({
            message: 'Facebook Share',
            link: [
              {
                url: 'https://www.facebook.com/permalink.php?story_fbid=139572695224922&id=100776219104570',
                type: 'other',
                title: 'Test',
                description: 'Facebook Share',
                imagePreview:
                  'https://scontent.fbkk12-4.fna.fbcdn.net/v/t39.30808-1/257382132_100776269104565_5345001410806291244_n.png?_nc_cat=110&ccb=1-5&_nc_sid=baafbc&_nc_ohc=VlkK08pa4vkAX8D61gA&_nc_ht=scontent.fbkk12-4.fna&oh=00_AT_0Wvk5Tmj-3Gmo6b7cJ8uFgluujDHro9oBiPlXsnqGnA&oe=625185C0',
              },
            ],
          }),
        ),
        'handleWebhook:contents-created',
      );
    });
  });

  it('should create short content from link share', async () => {
    (getLinkPreview as jest.Mock).mockResolvedValueOnce({
      url: 'https://www.castcle.com/icon',
      mediaType: 'image',
    });

    const post = [
      {
        id: socialId.valid,
        time: 1649148511,
        changes: [
          {
            value: {
              from: { id: socialId.valid, name: 'Castcle' },
              link: 'https://www.castcle.com',
              message: 'Decentralized Social Media',
              post_id: '100776219104570_150101544172037',
              created_time: 1649148508,
              item: 'share',
              published: 1,
              share_id: '150101547505370',
              verb: 'add',
            },
            field: 'feed',
          },
        ],
      },
    ] as unknown as SubscriptionEntry<FeedEntryChange>[];

    await expect(controller.handleWebhook(post)).resolves.not.toThrow();
    expect(logger.log).lastCalledWith(
      expect.stringContaining(post[0].changes[0].value.message),
      'handleWebhook:contents-created',
    );
    expect(logger.log).lastCalledWith(
      expect.stringContaining(
        JSON.stringify({
          message: 'Decentralized Social Media',
          photo: { contents: [{ original: 'uploaded-image-url' }] },
        }),
      ),
      'handleWebhook:contents-created',
    );
  });
});
