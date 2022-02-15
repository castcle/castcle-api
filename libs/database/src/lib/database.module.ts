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
import {
  NotificationProducer,
  UtilsQueueModule,
} from '@castcle-api/utils/queue';
import { Global, Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { getMongooseModuleOptions } from './database.config';
import {
  AccountActivationSchema,
  AccountAuthenIdSchema,
  AccountReferralSchema,
  AccountSchemaFactory,
  AdsCampaignSchema,
  CampaignSchema,
  CommentSchemaFactory,
  ContentSchemaFactory,
  CountrySchema,
  CredentialSchemaFactory,
  DsContentReachSchema,
  EngagementSchemaFactory,
  FeedItemSchemaFactory,
  GuestFeedItemSchema,
  HashtagSchema,
  LanguageSchema,
  NotificationSchema,
  OtpSchema,
  QueueSchema,
  RelationshipSchemaFactory,
  RevisionSchemaFactory,
  SocialSyncSchema,
  TransactionSchema,
  UserSchemaFactory,
  UxEngagementSchema,
} from './schemas';
import { AdsPlacementSchema } from './schemas/ads-placement.schema';
import { DefaultContentSchema } from './schemas/default-content.schema';
import { AdsService } from './services/ads.service';
import { AuthenticationService } from './services/authentication.service';
import { CampaignService } from './services/campaign.service';
import { CommentService } from './services/comment.service';
import { ContentService } from './services/content.service';
import { CountryService } from './services/country.service';
import { HashtagService } from './services/hashtag.service';
import { LanguageService } from './services/language.service';
import { NotificationService } from './services/notification.service';
import { RankerService } from './services/ranker.service';
import { SearchService } from './services/search.service';
import { SocialSyncService } from './services/social-sync.service';
import { UserService } from './services/user.service';
import { UxEngagementService } from './services/uxengagement.service';
import {
  createCastcleMeta,
  getRelationship,
  getSocialProfix,
} from './utils/common';

export const MongooseForFeatures = MongooseModule.forFeature([
  { name: 'AccountActivation', schema: AccountActivationSchema },
  { name: 'AccountAuthenId', schema: AccountAuthenIdSchema },
  { name: 'AccountReferral', schema: AccountReferralSchema },
  { name: 'Campaign', schema: CampaignSchema },
  { name: 'Country', schema: CountrySchema },
  { name: 'DsContentReach', schema: DsContentReachSchema },
  { name: 'GuestFeedItem', schema: GuestFeedItemSchema },
  { name: 'Hashtag', schema: HashtagSchema },
  { name: 'Language', schema: LanguageSchema },
  { name: 'Notification', schema: NotificationSchema },
  { name: 'Otp', schema: OtpSchema },
  { name: 'Queue', schema: QueueSchema },
  { name: 'SocialSync', schema: SocialSyncSchema },
  { name: 'UxEngagement', schema: UxEngagementSchema },
  { name: 'Transaction', schema: TransactionSchema },
  { name: 'DefaultContent', schema: DefaultContentSchema },
  { name: 'AdsCampaign', schema: AdsCampaignSchema },
  { name: 'AdsPlacement', schema: AdsPlacementSchema },
]);

export const MongooseAsyncFeatures = MongooseModule.forFeatureAsync([
  { name: 'Credential', useFactory: CredentialSchemaFactory },
  { name: 'Relationship', useFactory: RelationshipSchemaFactory },
  { name: 'Revision', useFactory: RevisionSchemaFactory },
  {
    name: 'Comment',
    useFactory: CommentSchemaFactory,
    inject: [getModelToken('Revision'), getModelToken('Content')],
  },
  {
    name: 'FeedItem',
    useFactory: FeedItemSchemaFactory,
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
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseModuleOptions(),
    }),
    MongooseAsyncFeatures,
    MongooseForFeatures,
    UtilsCacheModule,
    UtilsQueueModule,
  ],
  controllers: [],
  providers: [
    AuthenticationService,
    UserService,
    CampaignService,
    ContentService,
    UxEngagementService,
    NotificationService,
    RankerService,
    NotificationProducer,
    LanguageService,
    HashtagService,
    SearchService,
    CountryService,
    SocialSyncService,
    CommentService,
    AdsService,
  ],
  exports: [
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
  getSocialProfix,
  AdsService,
};
