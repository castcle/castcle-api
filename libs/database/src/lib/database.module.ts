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
  CastcleBackofficeMongooseModule,
  CastcleBullModule,
  CastcleCacheModule,
  CastcleMongooseModule,
  Environment,
} from '@castcle-api/environments';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { QueueName } from './models';
import { Repository } from './repositories';
import {
  AccountActivationSchema,
  AccountAuthenIdSchema,
  AccountDeviceSchema,
  AccountReferralSchema,
  AccountSchemaFactory,
  AdsCampaignSchema,
  AdsPlacementSchema,
  AnalyticSchema,
  CAccountSchema,
  CampaignSchema,
  CommentSchemaFactory,
  ContentFarmingSchema,
  ContentSchemaFactory,
  CredentialSchema,
  DefaultContentSchema,
  DsContentReachSchema,
  EngagementSchemaFactory,
  FeedItemSchema,
  GuestFeedItemSchema,
  HashtagSchema,
  MetadataSchema,
  NetworkSchema,
  NotificationSchema,
  OtpSchema,
  QueueSchema,
  RelationshipSchema,
  ReportingSchema,
  RevisionSchema,
  SocialSyncSchema,
  TransactionSchema,
  UserSchemaFactory,
  UxEngagementSchema,
  WalletShortcutSchema,
} from './schemas';
import { FeedItemV2Schema } from './schemas/feed-item-v2.schema';
import { AdsService } from './services/ads.service';
import { AnalyticService } from './services/analytic.service';
import { AuthenticationService } from './services/authentication.service';
import { AuthenticationServiceV2 } from './services/authentication.service.v2';
import { CampaignService } from './services/campaign.service';
import { CommentService } from './services/comment.service';
import { CommentServiceV2 } from './services/comment.service.v2';
import { ContentService } from './services/content.service';
import { ContentServiceV2 } from './services/content.service.v2';
import { DataService } from './services/data.service';
import { HashtagService } from './services/hashtag.service';
import { MetadataServiceV2 } from './services/metadata.service.v2';
import { NotificationService } from './services/notification.service';
import { NotificationServiceV2 } from './services/notification.service.v2';
import { RankerService } from './services/ranker.service';
import { SearchService } from './services/search.service';
import { SearchServiceV2 } from './services/search.service.v2';
import { SocialSyncService } from './services/social-sync.service';
import { SocialSyncServiceV2 } from './services/social-sync.service.v2';
import { SuggestionServiceV2 } from './services/suggestion.service.v2';
import { TAccountService } from './services/taccount.service';
import { UserService } from './services/user.service';
import { UserServiceV2 } from './services/user.service.v2';
import { UxEngagementService } from './services/uxengagement.service';
import { WalletShortcutService } from './services/wallet-shortcut.service';

import {
  createCastcleMeta,
  getRelationship,
  getSocialPrefix,
} from './utils/common';

export const MongooseForFeatures = (connectionName?: string) =>
  MongooseModule.forFeature(
    [
      { name: 'AccountActivation', schema: AccountActivationSchema },
      { name: 'AccountAuthenId', schema: AccountAuthenIdSchema },
      { name: 'AccountDevice', schema: AccountDeviceSchema },
      { name: 'AccountReferral', schema: AccountReferralSchema },
      { name: 'AdsCampaign', schema: AdsCampaignSchema },
      { name: 'AdsPlacement', schema: AdsPlacementSchema },
      { name: 'Analytic', schema: AnalyticSchema },
      { name: 'CAccount', schema: CAccountSchema },
      { name: 'Campaign', schema: CampaignSchema },
      { name: 'ContentFarming', schema: ContentFarmingSchema },
      { name: 'DefaultContent', schema: DefaultContentSchema },
      { name: 'DsContentReach', schema: DsContentReachSchema },
      { name: 'GuestFeedItem', schema: GuestFeedItemSchema },
      { name: 'Hashtag', schema: HashtagSchema },
      { name: 'Metadata', schema: MetadataSchema },
      { name: 'Network', schema: NetworkSchema },
      { name: 'Notification', schema: NotificationSchema },
      { name: 'Otp', schema: OtpSchema },
      { name: 'Queue', schema: QueueSchema },
      { name: 'Reporting', schema: ReportingSchema },
      { name: 'UxEngagement', schema: UxEngagementSchema },
      { name: 'WalletShortcut', schema: WalletShortcutSchema },
    ],
    connectionName,
  );

export const MongooseAsyncFeatures = (connectionName?: string) =>
  MongooseModule.forFeatureAsync(
    [
      { name: 'Credential', useFactory: () => CredentialSchema },
      { name: 'FeedItem', useFactory: () => FeedItemSchema },
      { name: 'FeedItemV2', useFactory: () => FeedItemV2Schema },
      { name: 'Relationship', useFactory: () => RelationshipSchema },
      { name: 'Revision', useFactory: () => RevisionSchema },
      { name: 'SocialSync', useFactory: () => SocialSyncSchema },
      { name: 'Transaction', useFactory: () => TransactionSchema },
      {
        name: 'Comment',
        useFactory: CommentSchemaFactory,
        inject: [getModelToken('Revision')],
      },
      {
        name: 'Content',
        useFactory: ContentSchemaFactory,
        inject: [
          getModelToken('Revision'),
          getModelToken('FeedItemV2'),
          getModelToken('User'),
          getModelToken('Relationship'),
        ],
      },
      {
        name: 'Account',
        useFactory: AccountSchemaFactory,
        inject: [getModelToken('Credential'), getModelToken('User')],
      },
      {
        name: 'User',
        useFactory: UserSchemaFactory,
        inject: [
          getModelToken('Relationship'),
          getModelToken('SocialSync'),
          getModelToken('Transaction'),
        ],
      },
      {
        name: 'Engagement',
        useFactory: EngagementSchemaFactory,
        inject: [
          getModelToken('Content'),
          getModelToken('Comment'),
          getModelToken('FeedItemV2'),
        ],
      },
    ],
    connectionName,
  );

const providers = [
  AdsService,
  AnalyticService,
  AuthenticationService,
  AuthenticationServiceV2,
  CampaignService,
  CommentService,
  CommentServiceV2,
  ContentService,
  ContentServiceV2,
  DataService,
  HashtagService,
  MetadataServiceV2,
  NotificationService,
  NotificationServiceV2,
  RankerService,
  Repository,
  SearchService,
  SearchServiceV2,
  SocialSyncService,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
  UserService,
  UserServiceV2,
  UxEngagementService,
  WalletShortcutService,
];

const exportProviders = [
  AdsService,
  AnalyticService,
  AuthenticationService,
  AuthenticationServiceV2,
  CampaignService,
  CommentService,
  CommentServiceV2,
  ContentService,
  ContentServiceV2,
  DataService,
  HashtagService,
  MetadataServiceV2,
  NotificationService,
  NotificationServiceV2,
  RankerService,
  Repository,
  SearchService,
  SearchServiceV2,
  SocialSyncService,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
  UserService,
  UserServiceV2,
  UxEngagementService,
  WalletShortcutService,
];

@Module({
  imports: [
    CastcleBullModule,
    CastcleCacheModule,
    CastcleMongooseModule,
    BullModule.registerQueue(
      { name: QueueName.CAMPAIGN },
      { name: QueueName.CONTENT },
      { name: QueueName.NOTIFICATION },
      { name: QueueName.REPORTING },
      { name: QueueName.USER },
    ),
    HttpModule,
    MongooseForFeatures(),
    MongooseAsyncFeatures(),
    UtilsClientsModule,
  ],
  providers,
  exports: exportProviders,
})
export class DatabaseModule {}

@Module({
  imports: [
    CastcleBullModule,
    CastcleCacheModule,
    CastcleBackofficeMongooseModule,
    BullModule.registerQueue(
      { name: QueueName.CAMPAIGN },
      { name: QueueName.CONTENT },
      { name: QueueName.NOTIFICATION },
      { name: QueueName.REPORTING },
      { name: QueueName.USER },
    ),
    HttpModule,
    MongooseForFeatures(Environment.DB_DATABASE_NAME),
    MongooseAsyncFeatures(Environment.DB_DATABASE_NAME),
    UtilsClientsModule,
  ],
  providers,
  exports: [
    ...exportProviders,
    MongooseForFeatures(Environment.DB_DATABASE_NAME),
    MongooseAsyncFeatures(Environment.DB_DATABASE_NAME),
  ],
})
export class BackofficeDatabaseModule {}

export {
  AdsService,
  AnalyticService,
  AuthenticationService,
  AuthenticationServiceV2,
  CampaignService,
  CommentService,
  CommentServiceV2,
  ContentService,
  ContentServiceV2,
  createCastcleMeta,
  DataService,
  getRelationship,
  getSocialPrefix,
  HashtagService,
  MetadataServiceV2,
  NotificationService,
  NotificationServiceV2,
  RankerService,
  Repository,
  SearchService,
  SearchServiceV2,
  SocialSyncService,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
  UserService,
  UserServiceV2,
  UxEngagementService,
  WalletShortcutService,
};
