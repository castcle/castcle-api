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

import { CastcleName, CastcleRegExp } from '@castcle-api/common';
import { Configs } from '@castcle-api/environments';
import {
  AVATAR_SIZE_CONFIGS,
  AWSClient,
  COMMON_SIZE_CONFIGS,
  Image,
} from '@castcle-api/utils/aws';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isArray, isBoolean, isMongoId, isString } from 'class-validator';
import { DBRef } from 'mongodb';
import {
  AnyKeys,
  ClientSession,
  FilterQuery,
  Model,
  QueryOptions,
  SaveOptions,
  Types,
  UpdateQuery,
} from 'mongoose';
import { lastValueFrom, map } from 'rxjs';
import {
  GetAvailableIdResponse,
  WalletBalance,
  pipelineGetAdsCampaigns,
  pipelineGetContentsV2,
  pipelineGetFarmAmount,
  pipelineGetFeedDefaults,
  pipelineOfGetAvailableId,
  pipelineOfGetParticipate,
  pipelineOfGetParticipates,
  pipelineOfGetWalletBalance,
} from '../aggregations';
import {
  Author,
  BlogPayload,
  CastcleQueryOptions,
  CreateContentDto,
  EntityVisibility,
  NotificationSource,
  NotificationType,
  Participates,
  ShortPayload,
  SortDirection,
  Url,
  UserField,
} from '../dtos';
import {
  AdsBoostStatus,
  AdsPaymentMethod,
  AdsStatus,
  CAccountNo,
  CastcleIdMetadata,
  CommentType,
  ContentFarmingStatus,
  ContentType,
  Country,
  EmailDomainDisposable,
  GetContentPayload,
  GetFarmingCountPayload,
  KeywordType,
  Language,
  MetadataType,
  OtpObjective,
  QueueStatus,
  ReportingStatus,
  ReportingSubject,
  ReportingType,
  SearchType,
  UserType,
} from '../models';
import {
  Account,
  AdsCampaign,
  AdsPlacement,
  CAccountNature,
  Comment,
  Content,
  ContentFarming,
  DefaultContent,
  Engagement,
  FeedItem,
  Hashtag,
  Metadata,
  Network,
  Notification,
  Otp,
  OtpModel,
  Queue,
  Relationship,
  Reporting,
  Revision,
  SocialSync,
  Transaction,
  User,
  UxEngagement,
  cAccount,
} from '../schemas';
import { FeedItemV2 } from '../schemas/feed-item-v2.schema';
import { WalletShortcut } from '../schemas/wallet-shortcut.schema';
import { createCastcleFilter } from '../utils/common';

type AccountQuery = {
  _id?: any;
  email?: string;
  provider?: string;
  socialId?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
  referredBy?: string;
  uuid?: string;
  platform?: string;
  activationToken?: string;
};

type UserQuery = {
  /** Mongo ID or castcle ID */
  _id?: string | Types.ObjectId[] | string[];
  accountId?: string | Types.ObjectId | Types.ObjectId[];
  castcleId?: string;
  excludeRelationship?: string[] | User[];
  keyword?: {
    input?: string;
    type?: KeywordType;
  };
  sinceId?: string;
  type?: UserType;
  untilId?: string;
  visibility?: EntityVisibility | EntityVisibility[];
};

type EngagementQuery = {
  contentId?: string;
  type?: string;
  sinceId?: string;
  untilId?: string;
  user?: User | User[] | Types.ObjectId;
  targetRef?: any;
  itemId?: string;
};

type RelationshipQuery = {
  userId?: User | User[] | Types.ObjectId;
  followedUser?: User | User[] | Types.ObjectId | string[];
  blocking?: boolean;
  following?: boolean;
  sinceId?: string;
  untilId?: string;
};

type NotificationQueryOption = {
  _id?: string;
  account?: Account;
  user?: User | Types.ObjectId;
  source?: NotificationSource;
  sinceId?: string;
  untilId?: string;
  read?: boolean;
  type?: NotificationType;
  contentRef?: Types.ObjectId | any;
  commentRef?: Types.ObjectId | any;
  replyRef?: Types.ObjectId | any;
  advertiseId?: Types.ObjectId | any;
  profileRef?: Types.ObjectId | any;
  sourceUserId?: Types.ObjectId;
};

type ContentQuery = {
  _id?: string | string[];
  author?: string | Types.ObjectId | string[];
  contentType?: string;
  decayDays?: number;
  excludeAuthor?: string[] | User[];
  excludeContents?: Content[];
  isQuote?: boolean;
  isRecast?: boolean;
  keyword?: {
    input: string;
    type: KeywordType;
  };
  maxResults?: number;
  message?: string;
  originalPost?: string;
  sinceId?: string;
  type?: ContentType[];
  sortBy?: Record<string, 1 | -1>;
  untilId?: string;
  viewer?: User;
  visibility?: EntityVisibility | EntityVisibility[];
};

type HashtagQuery = {
  tag?: string;
  tags?: string[];
  score?: number;
  keyword?: {
    input: string;
    type: KeywordType;
  };
};

type SocialSyncQuery = {
  _id?: string;
  user?: string;
};

type WalletShortcutQuery = {
  _id?: string;
  address?: string;
  accountId?: string;
};

type MetadataQuery = {
  type?: MetadataType;
  subject?: string;
};

type ReportingQuery = {
  by?: Types.ObjectId;
  payloadId?: Types.ObjectId | Types.ObjectId[];
  subject?: string;
  user?: Types.ObjectId;
  _id?: string;
  type?: ReportingType;
  status?: ReportingStatus[];
  createdAt_lt?: Date;
};

type CommentQuery = {
  _id?: string;
  targetRef?: any;
  type?: CommentType;
};

type ParticipateQuery = {
  targetRef: DBRef | DBRef[];
  userId?: string;
};

type AdsCampaignQuery = {
  excludeAds?: Types.ObjectId[];
  boostStatus?: AdsBoostStatus;
  status?: AdsStatus;
};

type GetFarmAmountQuery = {
  content?: Types.ObjectId[];
  status?: ContentFarmingStatus;
};

@Injectable()
export class Repository {
  private castcleIdMetadata: CastcleIdMetadata;
  private castcleEmailDomain: EmailDomainDisposable;

  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('AdsCampaign') private adsCampaignModel: Model<AdsCampaign>,
    @InjectModel('AdsPlacement') private adsPlacementModel: Model<AdsPlacement>,
    @InjectModel('cAccount') private caccountModel: Model<cAccount>,
    @InjectModel('Comment') private commentModel: Model<Comment>,
    @InjectModel('Content') private contentModel: Model<Content>,
    @InjectModel('ContentFarming')
    private contentFarmingModel: Model<ContentFarming>,
    @InjectModel('DefaultContent')
    private defaultContentModel: Model<DefaultContent>,
    @InjectModel('Engagement') private engagementModel: Model<Engagement>,
    @InjectModel('FeedItem') private feedItemModel: Model<FeedItem>,
    @InjectModel('FeedItemV2') private feedItemV2Model: Model<FeedItemV2>,
    @InjectModel('Hashtag') private hashtagModel: Model<Hashtag>,
    @InjectModel('Metadata')
    private metadataModel: Model<Metadata<any>>,
    @InjectModel('Network') private networkModel: Model<Network>,
    @InjectModel('Notification') private notificationModel: Model<Notification>,
    @InjectModel('Otp') private otpModel: OtpModel,
    @InjectModel('Queue') private queueModel: Model<Queue>,
    @InjectModel('Relationship') private relationshipModel: Model<Relationship>,
    @InjectModel('Reporting') private reportingModel: Model<Reporting>,
    @InjectModel('Revision') private revisionModel: Model<Revision>,
    @InjectModel('SocialSync') private socialSyncModel: Model<SocialSync>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('UxEngagement') private uxEngagementModel: Model<UxEngagement>,
    @InjectModel('WalletShortcut')
    private walletShortcutModel: Model<WalletShortcut>,
    private httpService: HttpService,
  ) {}

  private getBase64FromUrl(url: string) {
    return lastValueFrom(
      this.httpService
        .get(url, {
          responseType: 'arraybuffer',
        })
        .pipe(
          map(({ data }) => Buffer.from(data, 'binary').toString('base64')),
        ),
    );
  }

  private isValidCastcleId(castcleId: string) {
    const hasBannedWord = this.castcleIdMetadata.bannedWords.some(
      (bannedWord) => new RegExp(bannedWord, 'i').test(castcleId),
    );

    return (
      !hasBannedWord &&
      castcleId.length >= this.castcleIdMetadata.minLength &&
      castcleId.length <= this.castcleIdMetadata.maxLength
    );
  }

  private randomCastcleId() {
    const randomLength = (length = 0) => {
      return Math.floor(Math.random() * length);
    };

    return `${
      this.castcleIdMetadata.adjectives[
        randomLength(this.castcleIdMetadata.adjectives.length)
      ]
    }${
      this.castcleIdMetadata.nouns[
        randomLength(this.castcleIdMetadata.nouns.length)
      ]
    }`;
  }

  async suggestCastcleId(preferredCastcleId?: string) {
    if (!this.castcleIdMetadata) {
      const castcleIdMetadata = await AWSClient.getCastcleMetadata(
        Configs.AssetsPath.SuggestWords,
      );

      this.castcleIdMetadata = castcleIdMetadata;
    }

    const castcleId =
      !this.castcleIdMetadata || this.isValidCastcleId(preferredCastcleId)
        ? CastcleName.toSlug(preferredCastcleId)
        : this.randomCastcleId();

    const [availableId] =
      await this.userModel.aggregate<GetAvailableIdResponse>(
        pipelineOfGetAvailableId(castcleId),
      );

    return `${castcleId}${availableId ? availableId?.number : ''}`;
  }

  private getAccountQuery(filter: AccountQuery) {
    const query: FilterQuery<Account> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter._id) query._id = filter._id;
    if (filter.email) query.email = CastcleRegExp.fromString(filter.email);
    if (filter.mobileNumber) query['mobile.number'] = filter.mobileNumber;
    if (filter.referredBy) query.referralBy = filter.referredBy;
    if (filter.uuid) query['devices.uuid'] = filter.uuid;
    if (filter.platform) query['devices.platform'] = filter.platform;
    if (filter.mobileCountryCode)
      query['mobile.countryCode'] = filter.mobileCountryCode;
    if (filter.provider && filter.socialId) {
      query[`authentications.${filter.provider}.socialId`] = filter.socialId;
    }
    if (filter.activationToken)
      query['activations.verifyToken'] = filter.activationToken;

    return query;
  }

  private getRelationshipQuery = (filter: RelationshipQuery) => {
    const query: FilterQuery<Relationship> = {};

    if (filter.sinceId || filter.untilId) {
      query.followedUser = {};
      if (filter.sinceId) query.followedUser.$gt = filter.sinceId as any;
      if (filter.untilId) query.followedUser.$lt = filter.untilId as any;
    }
    if (filter.blocking) query.blocking = filter.blocking;
    if (filter.following) query.following = filter.following;
    if (filter.followedUser) query.followedUser = filter.followedUser as any;
    if (isArray(filter.followedUser))
      query.followedUser = { $in: filter.followedUser as any };
    if (filter.userId) query.user = filter.userId as any;
    if (isArray(filter.userId)) query.user = { $in: filter.userId as any };

    return query;
  };

  private getContentQuery = (filter: ContentQuery) => {
    const query: FilterQuery<Content> = {
      visibility: EntityVisibility.Publish,
    };

    if (isArray(filter._id))
      query._id = {
        $in: (filter._id as any).map((id) =>
          isString(id) ? new Types.ObjectId(id) : id,
        ),
      };
    else if (filter._id)
      query._id = isString(filter._id)
        ? new Types.ObjectId(filter._id as any)
        : filter._id;

    if (filter.message) query['payload.message'] = filter.message;
    if (filter.originalPost)
      query['originalPost._id'] = new Types.ObjectId(filter.originalPost);
    if (filter.author) query['author.id'] = filter.author;
    if (isArray(filter.author)) query['author.id'] = { $in: filter.author };
    if (filter.isRecast) query.isRecast = filter.isRecast;
    if (filter.isQuote) query.isQuote = filter.isQuote;
    if (isArray(filter.type)) query.type = { $in: filter.type };

    if (filter.keyword?.input) {
      if (filter.keyword.type === KeywordType.Hashtag) {
        query.hashtags = filter.keyword.input;
      } else if (filter.keyword.type === KeywordType.Mention) {
        query.$or = [
          {
            'author.castcleId': CastcleRegExp.fromString(filter.keyword.input, {
              exactMatch: false,
            }),
          },
          {
            'author.displayName': CastcleRegExp.fromString(
              filter.keyword.input,
              {
                exactMatch: false,
              },
            ),
          },
        ];
      } else {
        query['payload.message'] = CastcleRegExp.fromString(
          filter.keyword.input,
          {
            exactMatch: false,
          },
        );
      }
    }

    if (filter.contentType) {
      query[`payload.${filter.contentType}`] = { $exists: true };

      if (filter.contentType === SearchType.PHOTO)
        query[`payload.${filter.contentType}.contents`] = {
          $not: { $size: 0 },
        };
    }

    if (filter.decayDays) {
      query.$and = [
        { createdAt: { $lte: new Date() } },
        {
          createdAt: {
            $gte: new Date(
              new Date().getTime() - filter.decayDays * 1000 * 86400,
            ),
          },
        },
      ];
    }
    if (filter.excludeContents?.length)
      query._id = { $nin: filter.excludeContents };

    if (filter.excludeAuthor?.length)
      query['author.id'] = { $nin: filter.excludeAuthor };

    if (filter.visibility)
      query.visibility = filter.visibility as EntityVisibility;
    if (isArray(filter.visibility))
      query.visibility = { $in: filter.visibility as EntityVisibility[] };

    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  };

  private getCommentQuery = (filter: CommentQuery) => {
    const query: FilterQuery<Comment> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.type) query.type = filter.type;

    if (filter.targetRef) {
      let id;
      if (isArray(filter.targetRef.$id)) {
        id = { $in: filter.targetRef.$id };
      } else {
        id = new Types.ObjectId(filter.targetRef.$id);
      }

      query['targetRef.$id'] = id;
      query['targetRef.$ref'] = filter.targetRef.$ref;
    }

    return query;
  };

  private getEngagementQuery = (filter: EngagementQuery) => {
    const query: FilterQuery<Engagement> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.type) query.type = filter.type;
    if (isArray(filter.user)) query.user = { $in: filter.user as any };
    else if (filter.user) query.user = filter.user as any;
    if (filter.itemId) query.itemId = filter.itemId;
    if (filter.targetRef)
      query.targetRef = {
        $ref: filter.targetRef.$ref,
        $id: isArray(filter.targetRef.$id)
          ? { $in: filter.targetRef.$id }
          : new Types.ObjectId(filter.targetRef.$id),
      };
    if (isArray(filter.targetRef)) {
      query.targetRef = {
        $in: query.targetRef,
      };
    }
    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  };

  private getNotificationQuery = (filter: NotificationQueryOption) => {
    const query: FilterQuery<Notification> = {};
    if (filter?._id) query._id = filter._id;
    if (filter?.account) query.account = filter.account;
    if (filter?.source) query.source = filter.source;
    if (filter?.read) query.read = filter.read;
    if (filter?.type) query.type = filter.type;
    if (filter?.contentRef) query.contentRef = filter.contentRef;
    if (filter?.commentRef) query.commentRef = filter.commentRef;
    if (filter?.replyRef) query.replyRef = filter.replyRef;
    if (filter?.profileRef) query.profileRef = filter.profileRef;
    if (filter?.advertiseId) query.advertiseId = filter.advertiseId;
    if (filter?.sourceUserId) query.sourceUserId = filter.sourceUserId;
    if (filter?.user) query.user = filter.user;

    return createCastcleFilter(query, {
      sinceId: filter?.sinceId,
      untilId: filter?.untilId,
    });
  };

  private getHashtagQuery = (filter: HashtagQuery) => {
    const query: FilterQuery<Hashtag> = {
      score: {
        $gt: 0,
      },
    };
    if (filter.tag) query.tag = CastcleName.fromTagToSlug(filter.tag);
    if (filter.tags)
      query.tags = {
        $in: filter.tags.map((tag) => CastcleName.fromTagToSlug(tag)),
      };

    if (filter.keyword) {
      query.tag = CastcleRegExp.fromString(filter.keyword.input, {
        exactMatch: false,
      });
    }
    return query;
  };

  private getSocialSyncQuery(filter: SocialSyncQuery) {
    const query: FilterQuery<SocialSync> = {};

    if (filter._id) query._id = new Types.ObjectId(filter._id);
    if (filter.user) query.user = filter.user as any;

    return query;
  }

  private getWalletShortcutQuery(filter: WalletShortcutQuery) {
    const query: FilterQuery<WalletShortcut> = {};

    if (filter._id) query._id = filter._id as any;
    if (filter.accountId) query.account = filter.accountId as any;
    if (filter.address) query.address = filter.address;

    return query;
  }

  private getMetadataQuery(filter: MetadataQuery) {
    const query: FilterQuery<Metadata<Country | Language | ReportingSubject>> =
      {};

    if (filter.type) query.type = filter.type;
    if (filter.subject) query['payload.slug'] = filter.subject;

    return query;
  }

  private getReportingQuery(filter: ReportingQuery) {
    const query: FilterQuery<Reporting> = {};

    if (filter._id) query._id = filter._id;
    if (filter.createdAt_lt) query.createdAt = { $lt: filter.createdAt_lt };
    if (filter.payloadId) query['payload._id'] = filter.payloadId;
    if (isArray(filter.payloadId))
      query['payload._id'] = { $in: filter.payloadId };
    if (filter.status) query.status = { $in: filter.status };
    if (filter.subject) query.subject = filter.subject;
    if (filter.subject) query.subject = filter.subject;
    if (filter.type) query.type = filter.type;
    if (filter.user) query.user = filter.user;
    if (filter.by) query.by = filter.by;

    return query;
  }

  async isEmailDisposable(email: string) {
    if (!this.castcleEmailDomain)
      this.castcleEmailDomain = await AWSClient.getCastcleMetadata(
        Configs.AssetsPath.DomainEmailDisposables,
      );

    return this.castcleEmailDomain?.emailDomainDisposables?.some((domain) =>
      email.includes(domain),
    );
  }

  deleteAccount(filter: AccountQuery) {
    return this.accountModel.deleteOne(this.getAccountQuery(filter));
  }

  findAccount(filter: AccountQuery) {
    return this.accountModel.findOne(this.getAccountQuery(filter));
  }

  findAccounts(filter: AccountQuery, queryOptions?: QueryOptions) {
    return this.accountModel.find(
      this.getAccountQuery(filter),
      {},
      queryOptions,
    );
  }

  updateAccount(filter: AccountQuery, updateQuery?: UpdateQuery<Account>) {
    return this.accountModel.updateOne(
      this.getAccountQuery(filter),
      updateQuery,
    );
  }

  countAccount(filter: AccountQuery) {
    return this.accountModel
      .countDocuments(this.getAccountQuery(filter))
      .exec();
  }

  async createAccount(
    accountRequirements: AnyKeys<Account>,
    queryOptions?: SaveOptions,
  ) {
    const newAccount: Partial<Account> = {
      isGuest: true,
      preferences: {
        languages: accountRequirements['languagesPreferences'],
      },
      geolocation: accountRequirements.geolocation,
      visibility: EntityVisibility.Publish,
    };

    return new this.accountModel(newAccount).save(queryOptions);
  }

  async createContentImage(body: CreateContentDto, userId: string) {
    if (body.payload.photo && body.payload.photo.contents) {
      const newContents = await Promise.all(
        (body.payload.photo.contents as Url[]).map(async (item) => {
          return Image.upload(item.image, {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${userId}`,
          }).then((r) => r.image);
        }),
      );
      body.payload.photo.contents = newContents;
    }
    if (
      body.type === ContentType.Blog &&
      (body.payload as BlogPayload).photo.cover
    ) {
      (body.payload as BlogPayload).photo.cover = (
        await Image.upload(
          ((body.payload as BlogPayload).photo.cover as Url).image,
          {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${userId}`,
          },
        )
      ).image;
    }

    if ((body.payload as BlogPayload | ShortPayload).link) {
      const newLink = await Promise.all(
        ((body.payload as BlogPayload | ShortPayload).link as Url[]).map(
          async (item) => {
            if (!item?.image) return item;
            return {
              ...item,
              image: await Image.upload(item.image, {
                addTime: true,
                sizes: COMMON_SIZE_CONFIGS,
                subpath: `contents/${userId}`,
              }).then((r) => r.image),
            };
          },
        ),
      );

      (body.payload as any).link = newLink;
    }

    return body;
  }

  async createProfileImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `avatar-${accountId}`,
      addTime: true,
      sizes: AVATAR_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createCoverImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `cover-${accountId}`,
      addTime: true,
      sizes: COMMON_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createUser(user: AnyKeys<User>) {
    const suggestId = await this.suggestCastcleId(
      user.displayId || user.displayName,
    );

    user.displayId = this.getDisplayIdWithPrefix(suggestId);
    return new this.userModel(user).save();
  }

  private getDisplayIdWithPrefix(displayId: string) {
    if (displayId.startsWith('@')) return displayId;
    return `@${displayId}`;
  }

  private getUserQuery(filter: UserQuery) {
    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (Array.isArray(filter.accountId)) {
      query.ownerAccount = { $in: filter.accountId };
    } else if (filter.accountId) {
      query.ownerAccount = new Types.ObjectId(filter.accountId);
    }

    if (filter.type) query.type = filter.type;

    if (filter._id || filter.excludeRelationship) query.$and = [];
    if (Array.isArray(filter._id)) {
      query.$and.push({ _id: { $in: filter._id } });
    } else if (isMongoId(String(filter._id))) {
      query.$and.push({ _id: filter._id });
    } else if (filter._id) {
      query.$and.push({ displayId: CastcleRegExp.fromString(filter._id) });
    }

    if (filter.excludeRelationship) {
      query.$and.push({ _id: { $nin: filter.excludeRelationship } });
    }

    if (filter.keyword?.input) {
      query.$or = [
        {
          displayId: CastcleRegExp.fromString(filter.keyword.input, {
            exactMatch: false,
          }),
        },
        {
          displayName: CastcleRegExp.fromString(filter.keyword.input, {
            exactMatch: false,
          }),
        },
      ];
    }

    if (filter.castcleId) query.displayId = filter.castcleId;

    if (filter.visibility)
      query.visibility = filter.visibility as EntityVisibility;
    if (isArray(filter.visibility))
      query.visibility = { $in: filter.visibility as EntityVisibility[] };

    if (filter.sinceId || filter.untilId)
      return createCastcleFilter(query, {
        sinceId: filter.sinceId,
        untilId: filter.untilId,
      });

    return query;
  }

  findUser(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.findOne(this.getUserQuery(filter), {}, queryOptions);
  }

  findUsers(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.find(this.getUserQuery(filter), {}, queryOptions);
  }

  findUserCount(filter: UserQuery) {
    return this.userModel.countDocuments(filter as any);
  }

  updateUser(
    filter: UserQuery,
    user: UpdateQuery<User>,
    option?: QueryOptions,
  ) {
    return this.userModel.updateOne(this.getUserQuery(filter), user, option);
  }

  updateUsers(
    filter: UserQuery,
    user: UpdateQuery<User>,
    option?: QueryOptions,
  ) {
    return this.userModel.updateMany(filter as any, user, option);
  }

  findEngagement(filter: EngagementQuery, queryOptions?: QueryOptions) {
    return this.engagementModel
      .findOne(this.getEngagementQuery(filter), {}, queryOptions)
      .exec();
  }

  findEngagements(filter: EngagementQuery, queryOptions?: QueryOptions) {
    return this.engagementModel
      .find(this.getEngagementQuery(filter), {}, queryOptions)
      .exec();
  }

  countEngagements(filter: EngagementQuery) {
    return this.engagementModel
      .countDocuments(this.getEngagementQuery(filter))
      .exec();
  }

  createEngagement(engagement: AnyKeys<Engagement>) {
    return new this.engagementModel(engagement).save();
  }

  async deleteEngagements(filter: EngagementQuery) {
    const filterQuery = this.getEngagementQuery(filter);
    const engagements = await this.engagementModel.find(filterQuery);
    const $deletedEngagements = engagements.map((engagement) => {
      return engagement.set({ visibility: EntityVisibility.Deleted }).save();
    });

    return Promise.all($deletedEngagements);
  }

  updateEngagement(
    filter: EngagementQuery,
    updateQuery: UpdateQuery<Engagement>,
    option: QueryOptions,
  ) {
    return this.engagementModel.updateOne(
      this.getEngagementQuery(filter),
      updateQuery,
      option,
    );
  }

  updateEngagements(
    filter: EngagementQuery,
    updateQuery: UpdateQuery<Engagement>,
    option?: QueryOptions,
  ) {
    return this.engagementModel
      .updateMany(this.getEngagementQuery(filter), updateQuery, option)
      .exec();
  }

  findRelationships(filter: RelationshipQuery, queryOptions?: QueryOptions) {
    return this.relationshipModel.find(
      this.getRelationshipQuery(filter),
      {},
      queryOptions,
    );
  }

  findRelationship(
    filter: FilterQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.findOne(filter, {}, queryOptions);
  }

  updateRelationship(
    filter: FilterQuery<Relationship>,
    updateQuery?: UpdateQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.updateOne(filter, updateQuery, queryOptions);
  }

  deleteRelationship(
    filter: FilterQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.deleteOne(filter, queryOptions);
  }

  deleteRelationships(
    filter: FilterQuery<Relationship>,
    queryOptions?: QueryOptions,
  ) {
    return this.relationshipModel.deleteMany(filter, queryOptions);
  }

  findContent(filter: ContentQuery, queryOptions?: QueryOptions) {
    return this.contentModel
      .findOne(this.getContentQuery(filter), {}, queryOptions)
      .exec();
  }

  findContents(filter: ContentQuery, queryOptions?: QueryOptions) {
    return this.contentModel
      .find(this.getContentQuery(filter), {}, queryOptions)
      .exec();
  }
  countContents(filter: ContentQuery) {
    return this.contentModel
      .countDocuments(this.getContentQuery(filter))
      .exec();
  }

  aggregationContentsV2({ maxResults, sortBy, ...filter }: ContentQuery) {
    return this.contentModel.aggregate<GetContentPayload>(
      pipelineGetContentsV2({
        maxResults,
        sortBy,
        viewer: filter.viewer,
        filters: this.getContentQuery(filter),
      }),
    );
  }

  aggregationParticipates(filters: ParticipateQuery) {
    return this.engagementModel.aggregate<Participates>(
      pipelineOfGetParticipates(filters),
    );
  }

  aggregationParticipate(filters: ParticipateQuery) {
    return this.engagementModel.aggregate<Participates>(
      pipelineOfGetParticipate(filters),
    );
  }

  aggregationAdsCampaigns(filters: AdsCampaignQuery) {
    return this.adsCampaignModel.aggregate<any>(
      pipelineGetAdsCampaigns(filters),
    );
  }

  aggregationFeedDefault() {
    return this.defaultContentModel.aggregate<GetContentPayload>(
      pipelineGetFeedDefaults(),
    );
  }

  aggregationGetFarmAmount(filters: GetFarmAmountQuery) {
    return this.contentFarmingModel.aggregate<GetFarmingCountPayload>(
      pipelineGetFarmAmount(filters),
    );
  }

  aggregateRelationship<T = any>(pipeline: any) {
    return this.relationshipModel.aggregate<T>(pipeline);
  }

  async createContent(dto: AnyKeys<Content>) {
    const [content] = await Promise.all([
      new this.contentModel(dto).save(),
      this.userModel.updateOne({ _id: dto.author.id }, { $inc: { casts: 1 } }),
    ]);

    return content;
  }

  updateContent(
    filter: ContentQuery,
    updateQuery?: UpdateQuery<Content>,
    queryOptions?: QueryOptions,
  ) {
    return this.contentModel.updateOne(
      this.getContentQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  updateContents(
    filter: ContentQuery,
    updateQuery?: UpdateQuery<Content>,
    queryOptions?: QueryOptions,
  ) {
    return this.contentModel
      .updateMany(this.getContentQuery(filter), updateQuery, queryOptions)
      .exec();
  }

  async deleteContents(filterQuery: FilterQuery<Content>) {
    const contents = await this.contentModel.find(filterQuery);
    const hashtags: string[] = [];
    const $deletedContents = contents.map((content) => {
      hashtags.push(...(content.hashtags || []));

      return content.set({ visibility: EntityVisibility.Deleted }).save();
    });

    await Promise.all([
      this.hashtagModel.updateMany(
        { tag: { $in: hashtags }, score: { $gt: 0 } },
        { $inc: { score: -1 } },
      ),
      ...$deletedContents,
    ]);
  }

  createNotification(notify: AnyKeys<Notification>) {
    return new this.notificationModel(notify).save();
  }

  findNotification(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .findOne(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  findNotifications(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .find(this.getNotificationQuery(filter), {}, queryOptions)
      .exec();
  }

  updateNotification(
    filter: NotificationQueryOption,
    updateQuery?: UpdateQuery<Notification>,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel
      .updateOne(this.getNotificationQuery(filter), updateQuery, queryOptions)
      .exec();
  }

  updateNotifications(
    filter: NotificationQueryOption,
    updateQuery?: UpdateQuery<Notification>,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel.updateMany(
      this.getNotificationQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  deleteNotification(filter: NotificationQueryOption) {
    return this.notificationModel.deleteOne(this.getNotificationQuery(filter));
  }

  deleteNotifications(
    filter: NotificationQueryOption,
    queryOptions?: QueryOptions,
  ) {
    return this.notificationModel.deleteMany(
      this.getNotificationQuery(filter),
      queryOptions,
    );
  }

  aggregationNotification(pipeline: any[]) {
    return this.notificationModel.aggregate(pipeline);
  }

  findNotificationCount(filter: NotificationQueryOption) {
    return this.notificationModel
      .countDocuments(this.getNotificationQuery(filter))
      .exec();
  }

  removeFromTag(
    filter: HashtagQuery,
    updateQuery?: UpdateQuery<Hashtag>,
    queryOptions?: QueryOptions,
  ) {
    return this.hashtagModel.updateOne(
      this.getHashtagQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  removeFromTags(
    tags: string[],
    updateQuery?: UpdateQuery<Hashtag>,
    queryOptions?: QueryOptions,
  ) {
    return this.hashtagModel.updateMany(
      this.getHashtagQuery({ tags }),
      updateQuery,
      queryOptions,
    );
  }

  createOtp(createOtpDto: {
    accountId: string;
    objective: OtpObjective;
    requestId: string;
    channel: TwilioChannel;
    verified: boolean;
    receiver: string;
    sid?: string;
  }) {
    return this.otpModel.generate(
      createOtpDto.accountId,
      createOtpDto.objective,
      createOtpDto.requestId,
      createOtpDto.channel,
      createOtpDto.verified,
      createOtpDto.receiver,
      createOtpDto.sid,
    );
  }

  findOtp(dto: {
    channel?: TwilioChannel;
    verified?: boolean;
    objective?: OtpObjective;
    receiver?: string;
  }) {
    const query: FilterQuery<Otp> = { completedAt: { $exists: false } };

    if (dto.channel) query.channel = dto.channel;
    if (dto.objective) query.action = dto.objective;
    if (dto.receiver) query.receiver = dto.receiver;
    if (isBoolean(dto.verified)) query.isVerify = dto.verified;

    return this.otpModel.findOne(query);
  }

  accountSession(): Promise<ClientSession> {
    return this.accountModel.startSession();
  }

  createComment(comment: AnyKeys<Comment>) {
    return new this.commentModel(comment).save();
  }

  findComments(filter: CommentQuery, queryOptions?: QueryOptions) {
    return this.commentModel
      .find(this.getCommentQuery(filter), {}, queryOptions)
      .exec();
  }

  updateComments(
    filter: FilterQuery<Comment>,
    comment: UpdateQuery<Comment>,
    queryOptions?: QueryOptions,
  ) {
    return this.commentModel.updateMany(filter, comment, queryOptions).exec();
  }

  deleteComments(filter: FilterQuery<Comment>, queryOptions?: QueryOptions) {
    return this.commentModel.deleteMany(filter, queryOptions).exec();
  }

  deleteSocialSyncs(
    filter: FilterQuery<SocialSync>,
    queryOptions?: QueryOptions,
  ) {
    return this.socialSyncModel.deleteMany(filter, queryOptions);
  }

  updateFeedItem(
    filter: FilterQuery<FeedItemV2>,
    feedItem: UpdateQuery<FeedItemV2>,
    queryOptions?: QueryOptions,
  ) {
    return this.feedItemV2Model.updateOne(filter, feedItem, queryOptions);
  }

  async seenFeedItem(account: Account, feedItemId: string, uuid: string) {
    return this.feedItemV2Model
      .updateOne(
        {
          viewer: account._id,
          _id: feedItemId,
          seenAt: {
            $exists: false,
          },
        },
        {
          seenAt: new Date(),
          seenUUID: uuid,
        },
      )
      .exec();
  }

  findFeedItems = (
    filter: FilterQuery<FeedItemV2>,
    queryOptions?: QueryOptions,
  ) => this.feedItemV2Model.find(filter, queryOptions);

  async saveFeedItemFromContents(feedItems: AnyKeys<any>[]) {
    const [newFeeds] = await Promise.all([
      this.feedItemV2Model.create(
        feedItems.filter(({ wasNew }) => wasNew).map(({ newFeed }) => newFeed),
      ),
      this.feedItemV2Model.updateMany(
        {
          content: {
            $in: feedItems
              .filter(({ wasNew }) => !wasNew)
              .map(({ newFeed }) => newFeed.content),
          },
        },
        {
          calledAt: new Date(),
        },
      ),
    ]);

    return newFeeds;
  }

  findSocialSync(filter: SocialSyncQuery, queryOptions?: QueryOptions) {
    return this.socialSyncModel
      .findOne(this.getSocialSyncQuery(filter), {}, queryOptions)
      .exec();
  }

  updateSocialSync(
    filter: SocialSyncQuery,
    updateQuery: UpdateQuery<SocialSync>,
    queryOptions?: QueryOptions,
  ) {
    return this.socialSyncModel.updateOne(
      this.getSocialSyncQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  deleteFeedItems(filter: FilterQuery<FeedItem>, queryOptions?: QueryOptions) {
    return this.feedItemModel.deleteMany(filter, queryOptions);
  }

  findHashtags(filter: HashtagQuery, queryOptions?: QueryOptions) {
    return this.hashtagModel.find(
      this.getHashtagQuery(filter),
      {},
      queryOptions,
    );
  }

  getFindQueryForChild = (cAccount: cAccount) => {
    const orQuery = [
      {
        'ledgers.debit.cAccountNo': cAccount.no,
      },
      {
        'ledgers.credit.cAccountNo': cAccount.no,
      },
    ];
    if (cAccount.child)
      cAccount.child.forEach((childNo) => {
        orQuery.push({
          'ledgers.debit.cAccountNo': childNo,
        });
        orQuery.push({
          'ledgers.credit.cAccountNo': childNo,
        });
      });
    return orQuery;
  };

  findTransactionsOfCAccount = (cAccount: cAccount) => {
    const orQuery = this.getFindQueryForChild(cAccount);
    const findFilter: FilterQuery<Transaction> = {
      $or: orQuery,
    };
    return this.transactionModel.find(findFilter);
  };

  aggregateTransaction = (userId: Types.ObjectId) => {
    return this.transactionModel.aggregate<WalletBalance>(
      pipelineOfGetWalletBalance(userId),
    );
  };

  findCAccountByCaccountNO = (cAccountNo: string) =>
    this.caccountModel.findOne({ no: cAccountNo });

  getTAccountBalance = async (cAccountNo: string) => {
    //get account First
    const cAccount = await this.caccountModel.findOne({ no: cAccountNo });
    const txs = await this.findTransactionsOfCAccount(cAccount);
    const allDebit = txs.reduce((totalDebit, currentTx) => {
      return (
        totalDebit +
        currentTx.ledgers
          .filter(
            (t) =>
              cAccount.child.findIndex(
                (childNo) => t.debit.cAccountNo === childNo,
              ) >= 0 || cAccount.no === t.debit.cAccountNo,
          )
          .reduce((sumDebit, now) => Number(now.debit.value) + sumDebit, 0)
      );
    }, 0);
    const allCredit = txs.reduce((totalCredit, currentTx) => {
      return (
        totalCredit +
        currentTx.ledgers
          .filter(
            (t) =>
              cAccount.child.findIndex(
                (childNo) => t.credit.cAccountNo === childNo,
              ) >= 0 || cAccount.no === t.credit.cAccountNo,
          )
          .reduce((sumCredit, now) => Number(now.debit.value) + sumCredit, 0)
      );
    }, 0);
    if (cAccount.nature === CAccountNature.DEBIT) return allDebit - allCredit;
    else return allCredit - allDebit;
  };

  getUndistributedAdsplacements = async (
    paymentOptions?: AdsPaymentMethod,
  ): Promise<AdsPlacement[]> => {
    if (!paymentOptions)
      return this.adsPlacementModel.find({
        'cost.CAST': { $exits: false },
      });
    return this.adsPlacementModel.find({
      'cost.CAST': { $exits: false },
      'campaign.campaignPaymentType': paymentOptions,
    });
  };

  getCastUSDDistributeRate = async () => {
    const collectedCast = await this.getTAccountBalance(
      CAccountNo.SOCIAL_REWARD.NO,
    );
    const adsPlacements = await this.getUndistributedAdsplacements();
    const totalCost = adsPlacements.reduce((a, b) => a + b.cost.UST, 0);
    return collectedCast / totalCost;
  };

  pauseAdsFromContentId = async (contentId: string) =>
    this.adsCampaignModel.updateOne(
      { adsRef: new DBRef('content', new Types.ObjectId(contentId)) },
      { boostStatus: AdsBoostStatus.Pause },
    );

  async deleteCastcleAccount(account: Account) {
    const users = await this.userModel.find({ ownerAccount: account._id });
    const userIds = users.map((user) => user._id);

    const follower = await this.relationshipModel.find({
      $or: [{ followedUser: { $in: userIds } }, { user: { $in: userIds } }],
      following: true,
    });

    const $hardDelete = [
      this.commentModel.deleteMany({ 'author._id': { $in: userIds } }),
      this.notificationModel.deleteMany({ account: account._id }),
      this.otpModel.deleteMany({ account: account._id }),
      this.socialSyncModel.deleteMany({ account: account._id }),
      this.feedItemModel.deleteMany({ author: account._id }),
      this.relationshipModel.deleteMany({
        $or: [{ followedUser: { $in: userIds } }, { user: { $in: userIds } }],
      }),
      this.revisionModel.deleteMany({ 'payload.author.id': { $in: userIds } }),
      this.uxEngagementModel.deleteMany({ account: account._id }),
    ];

    const $softDelete = [
      account.set({ visibility: EntityVisibility.Deleted }).save(),
      this.adsCampaignModel.updateMany(
        { owner: { $in: userIds } },
        { boostStatus: AdsBoostStatus.End },
      ),
      this.deleteContents({ 'author._id': { $in: userIds } }),
      this.deleteEngagements({ user: userIds }),
      this.queueModel.updateMany(
        { 'payload.to.account': account._id, status: QueueStatus.WAITING },
        { status: QueueStatus.CANCELLED, endedAt: new Date() },
      ),
      this.userModel.updateMany(
        { _id: { $in: userIds } },
        { visibility: EntityVisibility.Deleted },
      ),
      userIds.map(async (id) => {
        await this.userModel.updateMany(
          {
            _id: {
              $in: follower
                .filter(({ user }) => String(user) === String(id))
                .map(({ followedUser }) => followedUser),
            },
          },
          { $inc: { followerCount: -1 } },
        );
        await this.userModel.updateMany(
          {
            _id: {
              $in: follower
                .filter(
                  ({ followedUser }) => String(followedUser) === String(id),
                )
                .map(({ user }) => user),
            },
          },
          { $inc: { followedCount: -1 } },
        );
      }),
    ];

    await Promise.all([...$hardDelete, ...$softDelete]);

    if (account.referralBy) {
      await this.accountModel.updateOne(
        { _id: account.referralBy },
        { $inc: { referralCount: -1 } },
      );
    }
  }

  async deletePage(pageId: Types.ObjectId) {
    const session = await this.userModel.startSession();
    await session.withTransaction(async () => {
      await Promise.all([
        this.updateUser(
          { _id: String(pageId) },
          { visibility: EntityVisibility.Deleted },
          { session },
        ),
        this.relationshipModel.deleteMany({
          $or: [{ followedUser: pageId as any }, { user: pageId as any }],
        }),
        this.deleteContents({ 'author._id': pageId }),
        this.deleteEngagements({ user: pageId }),
        this.deleteComments({ 'author._id': pageId }, { session }),
        this.deleteFeedItems({ author: pageId }, { session }),
        this.deleteSocialSyncs({ user: pageId }, { session }),
        this.deleteNotifications({ user: pageId }, { session }),
      ]);
      await session.commitTransaction();
      await session.endSession();
    });
  }

  async deleteAllContent(contentId: string) {
    const session = await this.contentModel.startSession();

    const contents = await this.contentModel.find({
      'originalPost._id': new Types.ObjectId(contentId),
    });

    await session.withTransaction(async () => {
      await Promise.all([
        this.deleteContents({
          'originalPost._id': new Types.ObjectId(contentId) as any,
        }),
        this.deleteContents({
          _id: new Types.ObjectId(contentId),
        }),
        this.deleteEngagements({
          targetRef: {
            $ref: 'content',
            $id: new Types.ObjectId(contentId),
          },
        }),
        this.deleteComments(
          {
            targetRef: {
              $ref: 'content',
              $id: new Types.ObjectId(contentId),
            },
          },
          { session },
        ),
        this.deleteFeedItems(
          { content: new Types.ObjectId(contentId) as any },
          { session },
        ),
        this.deleteNotifications(
          { contentRef: new Types.ObjectId(contentId) },
          { session },
        ),
        this.notificationModel.deleteMany(
          {
            contentRef: contents.map(({ _id }) => _id),
          },
          { session },
        ),
      ]);
      await session.commitTransaction();
      await session.endSession();
    });
  }

  async deleteUser(userId: string) {
    const session = await this.userModel.startSession();
    await session.withTransaction(async () => {
      const following = await this.relationshipModel.find({
        user: userId as any,
        following: true,
      });

      const follower = await this.relationshipModel.find({
        followedUser: userId as any,
        following: true,
      });

      const user = await this.userModel.findOne({
        _id: userId,
        visibility: EntityVisibility.Publish,
      });
      await Promise.all([
        this.updateUser(
          {
            _id: userId,
            visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
          },
          { $set: { visibility: EntityVisibility.Deleted } },
          { session },
        ),
        user
          ? (this.updateUsers(
              {
                _id: following.map(({ _id }) => _id),
              },
              { $inc: { followedCount: -1 } },
              { session },
            ),
            this.updateUsers(
              {
                _id: follower.map(({ _id }) => _id),
              },
              { $inc: { followerCount: -1 } },
              { session },
            ))
          : undefined,
        this.deleteRelationships({
          $or: [{ followedUser: userId as any }, { user: userId as any }],
        }),
        this.deleteContents({
          'author._id': userId,
        }),
        this.deleteEngagements({ user: userId as any }),
        this.deleteComments({ 'author._id': userId }, { session }),
        this.deleteFeedItems({ author: userId }, { session }),
        this.deleteSocialSyncs({ user: userId }, { session }),
        this.deleteNotifications({ user: userId as any }, { session }),
      ]);
      await session.commitTransaction();
      await session.endSession();
    });
  }

  findMetadata<T extends Country | Language | ReportingSubject>(
    filter?: MetadataQuery,
    queryOptions?: QueryOptions,
  ): Promise<Metadata<T>[]> {
    return this.metadataModel
      .find(this.getMetadataQuery(filter), {}, queryOptions)
      .exec();
  }

  findReportingSubject(
    filter?: MetadataQuery,
    queryOptions?: QueryOptions,
  ): Promise<Metadata<ReportingSubject>> {
    return this.metadataModel
      .findOne(this.getMetadataQuery(filter), {}, queryOptions)
      .exec();
  }

  async getPublicUsers({
    requestedBy,
    filter,
    queryOptions,
    expansionFields,
  }: {
    requestedBy: User;
    filter: UserQuery;
    queryOptions?: QueryOptions;
    expansionFields?: UserField[];
  }) {
    let users = await this.userModel.find(
      this.getUserQuery(filter),
      {},
      queryOptions,
    );

    if (
      users.some(
        (user) =>
          String(requestedBy?.ownerAccount) !== String(user.ownerAccount),
      )
    )
      users = users.filter(
        (user) => user.visibility === EntityVisibility.Publish,
      );

    const userIds = users.map((user) => user._id);
    const relationships =
      requestedBy && expansionFields?.includes(UserField.Relationships)
        ? await this.relationshipModel.find({
            user: requestedBy,
            followedUser: { $in: userIds },
          })
        : [];

    const $userResponses = users.map((user) => {
      if (String(user.ownerAccount) === String(requestedBy?.ownerAccount)) {
        return user.toOwnerResponse({ expansionFields });
      }

      if (expansionFields?.includes(UserField.Relationships)) {
        const relationship = relationships.find(
          (relationship) => String(relationship.followedUser) == user.id,
        );

        return user.toPublicResponse({
          blocked: relationship?.blocking ?? false,
          followed: relationship?.following ?? false,
        });
      }

      return user.toPublicResponse();
    });

    return Promise.all($userResponses);
  }

  createReporting(dto: AnyKeys<Reporting>) {
    return new this.reportingModel(dto).save();
  }

  updateReportings(
    filter: ReportingQuery,
    updateQuery: UpdateQuery<Reporting>,
    queryOptions?: QueryOptions,
  ) {
    return this.reportingModel.updateMany(
      this.getReportingQuery(filter),
      updateQuery,
      queryOptions,
    );
  }

  findReporting(filter: ReportingQuery, queryOptions?: QueryOptions) {
    return this.reportingModel
      .findOne(this.getReportingQuery(filter), {}, queryOptions)
      .exec();
  }

  findReportings(filter: ReportingQuery, queryOptions?: QueryOptions) {
    return this.reportingModel
      .find(this.getReportingQuery(filter), {}, queryOptions)
      .exec();
  }

  aggregateReporting(pipeline: any[]) {
    return this.reportingModel.aggregate(pipeline);
  }

  createWallerShortcut(dto: AnyKeys<WalletShortcut>) {
    return new this.walletShortcutModel(dto).save();
  }

  findWallerShortcut(filter: WalletShortcutQuery, queryOptions?: QueryOptions) {
    return this.walletShortcutModel
      .findOne(this.getWalletShortcutQuery(filter), {}, queryOptions)
      .exec();
  }

  findWallerShortcuts(
    filter: WalletShortcutQuery,
    queryOptions?: QueryOptions,
  ) {
    return this.walletShortcutModel
      .find(this.getWalletShortcutQuery(filter), {}, queryOptions)
      .exec();
  }

  updateWallerShortcut(
    filter: WalletShortcutQuery,
    updateQuery: UpdateQuery<WalletShortcut>,
    options?: QueryOptions,
  ) {
    return this.walletShortcutModel.updateOne(
      this.getWalletShortcutQuery(filter),
      updateQuery,
      options,
    );
  }

  deleteWalletShortcut(filter: WalletShortcutQuery) {
    return this.walletShortcutModel.deleteOne(
      this.getWalletShortcutQuery(filter),
    );
  }

  async findNetwork(chainId: string): Promise<Network> {
    return this.networkModel.findOne({ chainId });
  }

  async updateCastByReCastORQuote(
    contentId: string,
    visibility: EntityVisibility,
    increase?: number,
  ) {
    await this.updateContents(
      {
        originalPost: contentId,
        visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
      },
      { $set: { visibility } },
    );

    const contents = await this.findContents({
      originalPost: contentId,
    });
    await this.updateUsers(
      {
        _id: contents.map(({ author }) => author.id),
      },
      { $inc: { casts: increase ?? -1 } },
    );
  }

  /**
   * Get all hashtag that could get from the system sort by score
   * @param {string} keyword
   * @param {CastcleQueryOptions} queryOption
   * @returns {Hashtag[]}
   */
  searchHashtag = async (
    keyword: string,
    queryOptions: CastcleQueryOptions,
  ) => {
    const newKeyword = keyword.charAt(0) === '#' ? keyword.slice(1) : keyword;
    const query = {
      tag: { $regex: new RegExp('^' + newKeyword.toLowerCase(), 'i') },
    };

    queryOptions.sortBy = {
      field: 'score',
      type: SortDirection.DESC,
    };

    let hashtagQuery = this.hashtagModel.find(query);

    if (queryOptions?.limit)
      hashtagQuery = hashtagQuery.limit(queryOptions.limit);
    if (queryOptions?.page)
      hashtagQuery = hashtagQuery.skip(queryOptions.page - 1);
    if (queryOptions?.sortBy) {
      const sortDirection = queryOptions.sortBy.type === 'desc' ? '-' : '';
      const sortOrder = `${sortDirection}${queryOptions.sortBy.field}`;
      hashtagQuery = hashtagQuery.sort(sortOrder);
    }
    return hashtagQuery.exec();
  };

  getIncludesUsers = async (
    viewerAccount: Account,
    authors: Author[],
    hasRelationshipExpansion = false,
  ) => {
    const viewer = await this.userModel.findOne({
      ownerAccount: viewerAccount._id,
    });

    const authorIds = authors.map(({ id }) => id as any);
    const users = await this.userModel.find({ _id: { $in: authorIds } });
    const relationships = hasRelationshipExpansion
      ? await this.relationshipModel.find({
          $or: [
            { user: viewer?._id, followedUser: { $in: authorIds } },
            { user: { $in: authorIds }, followedUser: viewer?._id },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];

    return users.map((user) => {
      const author = {
        id: user._id,
        avatar: user.profile?.images?.avatar || null,
        castcleId: user.displayId,
        displayName: user.displayName,
        type: user.type as 'people' | 'page',
        verified: user.verified,
      };

      if (!hasRelationshipExpansion) return new Author(author).toIncludeUser();

      const getterRelationship = relationships.find(
        ({ followedUser, user }) =>
          String(followedUser) === String(author.id) &&
          String(user) === String(viewer?.id),
      );

      const blocked = Boolean(getterRelationship?.blocking);
      const followed = Boolean(getterRelationship?.following);

      return new Author(author).toIncludeUser({ blocked, followed });
    });
  };
}
