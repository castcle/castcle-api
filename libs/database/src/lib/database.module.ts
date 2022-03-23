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

import { UtilsCacheModule } from '@castcle-api/utils/cache';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import {
  getBullModuleOptions,
  getMongooseModuleOptions,
} from './database.config';
import { QueueName } from './models';
import {
  AccountActivationSchema,
  AccountAuthenIdSchema,
  AccountReferralSchema,
  AccountSchemaFactory,
  AdsCampaignSchema,
  AnalyticSchema,
  CampaignSchema,
  CommentSchemaFactory,
  ContentSchemaFactory,
  CountrySchema,
  CredentialSchema,
  DsContentReachSchema,
  EngagementSchemaFactory,
  FeedItemSchema,
  GuestFeedItemSchema,
  HashtagSchema,
  LanguageSchema,
  NotificationSchema,
  OtpSchema,
  QueueSchema,
  RelationshipSchema,
  RevisionSchema,
  SocialSyncSchema,
  TransactionSchema,
  UserSchemaFactory,
  UxEngagementSchema,
} from './schemas';
import { AccountDeviceSchema } from './schemas/account-device.schema';
import { AdsPlacementSchema } from './schemas/ads-placement.schema';
import { CAccountSchema } from './schemas/caccount';
import { DefaultContentSchema } from './schemas/default-content.schema';
import { AdsService } from './services/ads.service';
import { AnalyticService } from './services/analytic.service';
import { AuthenticationService } from './services/authentication.service';
import { CampaignService } from './services/campaign.service';
import { CommentService } from './services/comment.service';
import { ContentService } from './services/content.service';
import { CountryService } from './services/country.service';
import { DataService } from './services/data.service';
import { HashtagService } from './services/hashtag.service';
import { LanguageService } from './services/language.service';
import { NotificationService } from './services/notification.service';
import { RankerService } from './services/ranker.service';
import { SearchService } from './services/search.service';
import { SocialSyncService } from './services/social-sync.service';
import { TAccountService } from './services/taccount.service';
import { UserService } from './services/user.service';
import { UxEngagementService } from './services/uxengagement.service';
import {
  createCastcleMeta,
  getRelationship,
  getSocialPrefix,
} from './utils/common';

export const MongooseForFeatures = MongooseModule.forFeature([
  { name: 'AccountActivation', schema: AccountActivationSchema },
  { name: 'AccountAuthenId', schema: AccountAuthenIdSchema },
  { name: 'AccountReferral', schema: AccountReferralSchema },
  { name: 'AccountDevice', schema: AccountDeviceSchema },
  { name: 'AdsCampaign', schema: AdsCampaignSchema },
  { name: 'AdsPlacement', schema: AdsPlacementSchema },
  { name: 'Analytic', schema: AnalyticSchema },
  { name: 'Campaign', schema: CampaignSchema },
  { name: 'Country', schema: CountrySchema },
  { name: 'DefaultContent', schema: DefaultContentSchema },
  { name: 'DsContentReach', schema: DsContentReachSchema },
  { name: 'GuestFeedItem', schema: GuestFeedItemSchema },
  { name: 'Hashtag', schema: HashtagSchema },
  { name: 'Language', schema: LanguageSchema },
  { name: 'Notification', schema: NotificationSchema },
  { name: 'Otp', schema: OtpSchema },
  { name: 'Queue', schema: QueueSchema },
  { name: 'SocialSync', schema: SocialSyncSchema },
  { name: 'Transaction', schema: TransactionSchema },
  { name: 'UxEngagement', schema: UxEngagementSchema },
  { name: 'CAccount', schema: CAccountSchema },
]);

export const MongooseAsyncFeatures = MongooseModule.forFeatureAsync([
  { name: 'Credential', useFactory: () => CredentialSchema },
  { name: 'FeedItem', useFactory: () => FeedItemSchema },
  { name: 'Relationship', useFactory: () => RelationshipSchema },
  { name: 'Revision', useFactory: () => RevisionSchema },
  {
    name: 'Comment',
    useFactory: CommentSchemaFactory,
    inject: [getModelToken('Revision'), getModelToken('Content')],
  },
  {
    name: 'Content',
    useFactory: ContentSchemaFactory,
    inject: [
      getModelToken('Revision'),
      getModelToken('FeedItem'),
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
    inject: [getModelToken('Relationship')],
  },
  {
    name: 'Engagement',
    useFactory: EngagementSchemaFactory,
    inject: [
      getModelToken('Content'),
      getModelToken('Comment'),
      getModelToken('FeedItem'),
    ],
  },
]);

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => getBullModuleOptions(),
    }),
    BullModule.registerQueue(
      { name: QueueName.CAMPAIGN },
      { name: QueueName.CONTENT },
      { name: QueueName.NOTIFICATION },
      { name: QueueName.USER }
    ),
    HttpModule,
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseModuleOptions(),
    }),
    MongooseAsyncFeatures,
    MongooseForFeatures,
    UtilsCacheModule,
  ],
  providers: [
    AuthenticationService,
    UserService,
    CampaignService,
    ContentService,
    UxEngagementService,
    NotificationService,
    RankerService,
    LanguageService,
    HashtagService,
    SearchService,
    CountryService,
    SocialSyncService,
    CommentService,
    AdsService,
    AnalyticService,
    DataService,
    TAccountService,
  ],
  exports: [
    BullModule,
    AuthenticationService,
    UserService,
    CampaignService,
    ContentService,
    UxEngagementService,
    NotificationService,
    RankerService,
    LanguageService,
    HashtagService,
    SearchService,
    CountryService,
    SocialSyncService,
    CommentService,
    AdsService,
    AnalyticService,
    DataService,
    TAccountService,
  ],
})
export class DatabaseModule {}

export {
  AuthenticationService,
  UserService,
  CampaignService,
  ContentService,
  UxEngagementService,
  NotificationService,
  RankerService,
  LanguageService,
  HashtagService,
  SearchService,
  CountryService,
  createCastcleMeta,
  SocialSyncService,
  CommentService,
  getRelationship,
  getSocialPrefix,
  AdsService,
  AnalyticService,
  DataService,
  TAccountService,
};
