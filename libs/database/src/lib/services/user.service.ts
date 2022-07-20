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
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
} from '@castcle-api/utils/aws';
import { CastcleRegExp } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { isMongoId } from 'class-validator';
import * as mongoose from 'mongoose';
import { FilterQuery, Model, Types, UpdateWriteOpResult } from 'mongoose';
import { createTransport } from 'nodemailer';
import {
  GetBalanceResponse,
  GetUserRelationResponse,
  pipelineOfGetBalance,
  pipelineOfUserRelationFollowers,
  pipelineOfUserRelationMentions,
} from '../aggregations';
import {
  GetUserRelationParams,
  GetUserRelationResponseCount,
  pipelineOfUserRelationFollowersCount,
  pipelineOfUserRelationFollowing,
  pipelineOfUserRelationFollowingCount,
} from '../aggregations/get-users-relation.aggregation';
import {
  Author,
  CastcleQueryOptions,
  CastcleQueueAction,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility,
  GetSearchUsersDto,
  Meta,
  PageDto,
  PaginationQuery,
  SocialPageDto,
  SortBy,
  SortDirection,
  UpdateModelUserDto,
  UpdateUserDto,
  UserField,
  createFilterQuery,
} from '../dtos';
import {
  CastcleNumber,
  QueueName,
  UserImage,
  UserMessage,
  UserType,
} from '../models';
import {
  Account,
  AccountActivationModel,
  AccountAuthenId,
  AccountReferral,
  Comment,
  Content,
  Credential,
  Engagement,
  Hashtag,
  Relationship,
  SocialSync,
  Transaction,
  User,
} from '../schemas';
import { createCastcleFilter, createPagination } from '../utils/common';
import { ContentService } from './content.service';

/** @deprecated */
@Injectable()
export class UserService {
  private logger = new CastLogger(UserService.name);
  private transporter = createTransport({
    host: Environment.SMTP_HOST,
    port: Environment.SMTP_PORT,
    secure: true,
    auth: {
      user: Environment.SMTP_USERNAME,
      pass: Environment.SMTP_PASSWORD,
    },
  });

  constructor(
    @InjectModel('Account')
    public _accountModel: Model<Account>,
    @InjectModel('AccountActivation')
    public activationModel: Model<AccountActivationModel>,
    @InjectModel('AccountAuthenId')
    public _accountAuthenId: Model<AccountAuthenId>,
    @InjectModel('AccountReferral')
    public _accountReferral: Model<AccountReferral>,
    @InjectModel('Comment')
    private commentModel: Model<Comment>,
    @InjectModel('Content')
    private contentModel: Model<Content>,
    @InjectModel('Credential')
    public _credentialModel: Model<Credential>,
    @InjectModel('Engagement')
    public engagementModel: Model<Engagement>,
    @InjectModel('Hashtag')
    public hashtagModel: Model<Hashtag>,
    @InjectModel('Relationship')
    public _relationshipModel: Model<Relationship>,
    @InjectModel('SocialSync')
    private _socialSyncModel: Model<SocialSync>,
    @InjectModel('Transaction')
    private transactionModel: Model<Transaction>,
    @InjectModel('User')
    public _userModel: Model<User>,
    @InjectQueue(QueueName.USER)
    private userQueue: Queue<UserMessage>,
    private contentService: ContentService,
  ) {}

  getUserFromCredential = (credential: Credential) =>
    this._userModel
      .findOne({
        ownerAccount: credential?.account?._id,
        type: UserType.PEOPLE,
        visibility: {
          $in: [EntityVisibility.Publish, EntityVisibility.Illegal],
        },
      })
      .exec();

  getPagesFromCredential = (credential: Credential) =>
    this._userModel
      .find({
        ownerAccount: credential.account._id,
        type: UserType.PAGE,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  getPagesFromAccountId = (accountId: string) =>
    this._userModel
      .find({
        ownerAccount: accountId as any,
        type: UserType.PAGE,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  /**
   * Get user's balance
   * @param {User} user
   */
  getBalance = async (user: User) => {
    const [balance] = await this.transactionModel.aggregate<GetBalanceResponse>(
      pipelineOfGetBalance(String(user.ownerAccount)),
    );

    return CastcleNumber.from(balance?.total?.toString()).toNumber();
  };

  getUserFromAccountId = async (
    accountId: string,
    userFields?: UserField[],
  ) => {
    const account = await this._accountModel.findById(accountId).exec();
    const user = await this._userModel
      .findOne({
        ownerAccount: accountId as any,
        type: UserType.PEOPLE,
        visibility: EntityVisibility.Publish,
      })
      .exec();

    if (!account || !user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const balance = userFields?.includes(UserField.Wallet)
      ? await this.getBalance(user)
      : undefined;

    const authenSocial = userFields?.includes(UserField.LinkSocial)
      ? await this._accountAuthenId.find({ account: accountId as any }).exec()
      : undefined;

    let syncPage = undefined;
    if (userFields?.includes(UserField.SyncSocial)) {
      const pages = await this.getPagesFromAccountId(accountId);
      syncPage = await this._socialSyncModel.find({
        user: { $in: pages.map((page) => page._id) },
      });
    }

    const content = userFields?.includes(UserField.Casts)
      ? await this.contentService.getContentsFromUser(user.id)
      : undefined;

    return {
      user: user,
      account: account,
      balance: balance,
      authenSocial: authenSocial,
      syncPage: syncPage,
      casts: content?.total,
    };
  };

  /**
   * Get all user and page that this credentials is own
   * @param credential
   * @returns {User[]}
   */
  getUserAndPagesFromCredential = (credential: Credential) =>
    this.getUserAndPagesFromAccountId(credential.account._id);

  getUserAndPagesFromAccountId = (accountId: string) =>
    this._userModel
      .find({
        ownerAccount: accountId as any,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  private async convertUsersToUserResponses(
    viewer: User | null,
    users: User[],
    hasRelationshipExpansion = false,
    userFields?: UserField[],
  ) {
    if (!hasRelationshipExpansion && !userFields) {
      return Promise.all(
        users.map(async (user) => {
          return user.type === UserType.PAGE
            ? user.toPageResponse()
            : await user.toUserResponse();
        }),
      );
    }

    const userIds: any[] = users.map((user) => user.id);
    const relationships = viewer
      ? await this._relationshipModel.find({
          $or: [
            { user: viewer._id, followedUser: { $in: userIds } },
            { user: { $in: userIds }, followedUser: viewer._id },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];

    return Promise.all(
      users.map(async (u) => {
        const syncSocial = userFields?.includes(UserField.SyncSocial)
          ? await this._socialSyncModel.findOne({ user: u._id }).exec()
          : undefined;

        const content = userFields?.includes(UserField.Casts)
          ? await this.contentService.getContentsFromUser(u.id)
          : undefined;

        const userResponse =
          u.type === UserType.PAGE
            ? u.toPageResponse(
                undefined,
                undefined,
                undefined,
                syncSocial,
                content?.total,
              )
            : await u.toUserResponse({ casts: content?.total });

        const targetRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(user) === String(u.id) &&
                String(followedUser) === String(viewer?.id),
            )
          : undefined;

        const getterRelationship = hasRelationshipExpansion
          ? relationships.find(
              ({ followedUser, user }) =>
                String(followedUser) === String(u.id) &&
                String(user) === String(viewer?.id),
            )
          : undefined;

        userResponse.blocked = Boolean(getterRelationship?.blocking);
        userResponse.blocking = Boolean(targetRelationship?.blocking);
        userResponse.followed = Boolean(getterRelationship?.following);

        return userResponse;
      }),
    );
  }

  getById = async (
    user: User,
    id: string,
    type?: UserType,
    hasRelationshipExpansion = false,
    userFields?: UserField[],
  ) => {
    const targetUser = await this.getByIdOrCastcleId(id, type);

    if (!targetUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const [userResponse] = await this.convertUsersToUserResponses(
      user,
      [targetUser],
      hasRelationshipExpansion,
      userFields,
    );

    return userResponse;
  };

  getSearchUsers(
    user: User,
    {
      hasRelationshipExpansion,
      keyword,
      maxResults,
      sinceId,
      untilId,
    }: GetSearchUsersDto,
  ) {
    const queryOptions = { ...DEFAULT_QUERY_OPTIONS, limit: maxResults };
    const query = createFilterQuery<User>(sinceId, untilId);
    const pattern = CastcleRegExp.fromString(keyword, { exactMatch: false });

    queryOptions.sortBy.field = 'createdAt';
    query.$or = [{ displayId: pattern }, { displayName: pattern }];

    return this.getByCriteria(
      user,
      query,
      queryOptions,
      hasRelationshipExpansion,
    );
  }

  async getBlockedUsers(
    user: User,
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery,
  ) {
    const query: FilterQuery<Relationship> = {};

    if (sinceId || untilId) {
      query.followedUser = {};

      if (sinceId) query.followedUser.$gt = sinceId as any;
      if (untilId) query.followedUser.$lt = untilId as any;
    }

    query.user = user._id;
    query.blocking = true;

    const relationships = await this._relationshipModel
      .find(query)
      .sort({ followedUser: SortDirection.DESC })
      .limit(maxResults)
      .exec();

    const userIds = relationships.map(({ followedUser }) => followedUser);

    return this.getByCriteria(
      user,
      { _id: userIds },
      {},
      hasRelationshipExpansion,
    );
  }

  getByCriteria = async (
    viewer: User,
    query: FilterQuery<User>,
    queryOptions?: CastcleQueryOptions,
    hasRelationshipExpansion = false,
    userFields?: UserField[],
  ) => {
    const {
      items: targetUsers,
      pagination,
      meta,
    } = await this.getAllByCriteria(query, queryOptions);

    const users = await this.convertUsersToUserResponses(
      viewer,
      targetUsers,
      hasRelationshipExpansion,
      userFields,
    );

    return { pagination, users, meta };
  };

  getByIdOrCastcleId = (id: string, type?: UserType) => {
    if (!id) return null;

    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (type) query.type = type;
    if (isMongoId(String(id))) query._id = id;
    else query.displayId = CastcleRegExp.fromString(id);

    return this._userModel.findOne(query).exec();
  };

  /**
   * @param {string} id user ID or Castcle ID
   * @param {UserType} type user type: `people` or `page`
   * @throws {CastcleException} with CastcleStatus.REQUEST_URL_NOT_FOUND
   */
  findUser = async (id: string, type?: UserType) => {
    const user = await this.getByIdOrCastcleId(id, type);

    if (!user) throw new CastcleException('REQUEST_URL_NOT_FOUND');

    return user;
  };

  updateUser = (
    user: User,
    { images, links, contact, ...updateUserDto }: UpdateModelUserDto,
  ) => {
    if (!user.profile) user.profile = {};
    if (updateUserDto.castcleId) user.displayId = updateUserDto.castcleId;
    if (updateUserDto.displayName) user.displayName = updateUserDto.displayName;
    if (updateUserDto.displayName || updateUserDto.castcleId)
      user.displayIdUpdatedAt = new Date();
    if (updateUserDto.overview) user.profile.overview = updateUserDto.overview;
    if (updateUserDto.dob) user.profile.birthdate = new Date(updateUserDto.dob);

    if (images) {
      if (!user.profile.images) user.profile.images = {};
      if (images.avatar) user.profile.images.avatar = images.avatar;
      if (images.cover) user.profile.images.cover = images.cover;
    }

    if (links) {
      if (!user.profile.socials) user.profile.socials = {};
      const socialNetworks = ['facebook', 'medium', 'twitter', 'youtube'];
      socialNetworks.forEach((social) => {
        if (links[social]) user.profile.socials[social] = links[social];
        if (links.website)
          user.profile.websites = [
            {
              website: links.website,
              detail: links.website,
            },
          ];
      });
    }
    if (!user.contact) user.contact = {};
    if (contact?.countryCode) user.contact.countryCode = contact?.countryCode;
    if (contact?.email) user.contact.email = contact?.email;
    if (contact?.phone) user.contact.phone = contact?.phone;
    user.set(updateUserDto);
    user.markModified('profile');
    user.markModified('contact');
    console.debug('saving dto', updateUserDto);
    console.debug('saving website', user.profile.websites);
    console.debug('saving user', user);
    this.userQueue.add(
      {
        id: user._id,
        action: CastcleQueueAction.UpdateProfile,
      },
      {
        removeOnComplete: true,
      },
    );

    return user.save();
  };

  updateUserInEmbedContent = async (user: User) => {
    console.debug('updating contents of user');
    await this.contentModel
      .updateMany({ 'author.id': user._id }, { author: user.toAuthor() })
      .exec();
    console.debug('updating comments of user');
    await this.commentModel
      .updateMany({ 'author._id': user._id }, { author: user })
      .exec();
  };

  updateUserInEmbedContentBackground = async (userId: any) => {
    const user = await this._userModel.findById(userId).exec();
    await this.updateUserInEmbedContent(user);
  };

  deleteUserFromId = async (id: string) => {
    const user = await this._userModel.findById(id).exec();
    user.visibility = EntityVisibility.Deleted;
    return user.save();
  };

  createPageFromCredential = async (
    credential: Credential,
    pageDto: PageDto,
  ) => {
    const user = await this.getUserFromCredential(credential);
    return this.createPageFromUser(user, pageDto);
  };

  createPageFromUser = (user: User, pageDto: PageDto) => {
    const newPage = new this._userModel({
      ownerAccount: user.ownerAccount,
      type: UserType.PAGE,
      displayId: pageDto.castcleId,
      displayName: pageDto.displayName,
    });
    return newPage.save();
  };

  /**
   * get all users/pages by criteria
   * @param {CastcleQueryOptions} queryOptions
   * @returns {Promise<{items:User[], pagination:Pagination}>}
   */
  getAllByCriteria = async (
    query: FilterQuery<User>,
    queryOptions?: CastcleQueryOptions,
  ) => {
    const filterQuery = { ...query, visibility: EntityVisibility.Publish };
    const total = await this._userModel.countDocuments(filterQuery);
    let usersQuery = this._userModel.find(filterQuery);

    if (queryOptions?.limit) usersQuery = usersQuery.limit(queryOptions.limit);
    if (queryOptions?.page) usersQuery = usersQuery.skip(queryOptions.page - 1);
    if (queryOptions?.sortBy) {
      const sortDirection = queryOptions.sortBy.type === 'desc' ? '-' : '';
      const sortOrder = `${sortDirection}${queryOptions.sortBy.field}`;

      usersQuery = usersQuery.sort(sortOrder);
    }

    const users = await usersQuery.exec();

    return {
      items: users,
      pagination: createPagination(queryOptions, total),
      meta: Meta.fromDocuments(users, total),
    };
  };

  getAllPages = (queryOptions: CastcleQueryOptions) => {
    return this.getAllByCriteria({ type: UserType.PAGE }, queryOptions);
  };

  /**
   * Get all user pages
   * @param {User} user
   * @param {CastcleQueryOptions} queryOptions
   * @returns {Promise<{items:User[], pagination:Pagination}>}
   */
  getUserPages = async (user: User, queryOptions: CastcleQueryOptions) => {
    const filter = {
      ownerAccount: user.ownerAccount,
      type: UserType.PAGE,
      visibility: EntityVisibility.Publish,
    };
    const pages = this._userModel.find(filter).skip(queryOptions.page - 1);
    //.limit(queryOptions.limit); TODO !!! hack
    const pagination = createPagination(
      queryOptions,
      await this._userModel.countDocuments(filter),
    );
    let items: User[];
    if (queryOptions.sortBy.type === 'desc')
      items = await pages.sort(`-${queryOptions.sortBy.field}`).exec();
    else items = await pages.sort(`${queryOptions.sortBy.field}`).exec();
    return { items, pagination };
  };

  /**
   * @param {User} user
   * @param {User} followedUser
   */
  follow = async (user: User, followedUser: User) => {
    return user.follow(followedUser);
  };

  /**
   *
   * @param {User} user
   * @param {User} followedUser
   * @returns {Promise<void>}
   */
  unfollow = async (user: User, followedUser: User) =>
    user.unfollow(followedUser);

  getFollowers = async (
    viewer: User,
    targetUser: User,
    followQuery: PaginationQuery,
    sortBy?: SortBy,
    userType?: string,
  ) => {
    this.logger.log('Build followers query.');
    const params: GetUserRelationParams = {
      userId: targetUser._id,
      limit: followQuery.maxResults ?? DEFAULT_QUERY_OPTIONS.limit,
      sinceId: followQuery.sinceId,
      untilId: followQuery.untilId,
      userType: userType,
      sortBy: sortBy,
    };
    const pipeline = pipelineOfUserRelationFollowers(params);
    const pipelineCount = pipelineOfUserRelationFollowersCount(params);
    this.logger.log(
      JSON.stringify(pipeline),
      ' pipelineOfUserRelationFollowers:aggregate',
    );
    this.logger.log(
      JSON.stringify(pipelineCount),
      ' pipelineOfUserRelationFollowersCount:aggregate',
    );
    const userRelation =
      await this._relationshipModel.aggregate<GetUserRelationResponse>(
        pipeline,
      );

    const userRelationCount =
      await this._relationshipModel.aggregate<GetUserRelationResponseCount>(
        pipelineCount,
      );

    return this.buildRelationResponse(
      userRelation,
      userRelationCount,
      followQuery,
      viewer,
    );
  };

  getFollowing = async (
    viewer: User,
    targetUser: User,
    followQuery: PaginationQuery,
    sortBy?: SortBy,
    userType?: string,
  ) => {
    this.logger.log('Build following query.');
    const params: GetUserRelationParams = {
      userId: targetUser._id,
      limit: followQuery.maxResults ?? DEFAULT_QUERY_OPTIONS.limit,
      sinceId: followQuery.sinceId,
      untilId: followQuery.untilId,
      userType: userType,
      sortBy: sortBy,
    };
    const pipeline = pipelineOfUserRelationFollowing(params);
    const pipelineCount = pipelineOfUserRelationFollowingCount(params);
    this.logger.log(
      JSON.stringify(pipeline),
      ' pipelineOfUserRelationFollowing:aggregate',
    );
    this.logger.log(
      JSON.stringify(pipelineCount),
      ' pipelineOfUserRelationFollowingCount:aggregate',
    );
    const userRelation =
      await this._relationshipModel.aggregate<GetUserRelationResponse>(
        pipeline,
      );

    const userRelationCount =
      await this._relationshipModel.aggregate<GetUserRelationResponseCount>(
        pipelineCount,
      );

    return this.buildRelationResponse(
      userRelation,
      userRelationCount,
      followQuery,
      viewer,
    );
  };

  private async buildRelationResponse(
    userRelation: GetUserRelationResponse[],
    userRelationCount: GetUserRelationResponseCount[],
    followQuery: PaginationQuery,
    viewer: User,
  ) {
    const followingUsersId = userRelation.flatMap((u) =>
      u.user_relation.flatMap((r) => {
        return {
          userId: mongoose.Types.ObjectId(r._id),
          id: u._id,
        };
      }),
    );

    const hasRelationship = followQuery.userFields?.includes(
      UserField.Relationships,
    );

    this.logger.log('get user from following list');

    const { users } = await this.getByCriteria(
      viewer,
      {
        _id: { $in: followingUsersId.map((f) => f.userId) },
      },
      undefined,
      hasRelationship,
    );

    const resultTotal = userRelationCount[0]?.total ?? 0;
    return {
      users: this.mergeRelationUser(followingUsersId, users),
      meta: Meta.fromDocuments(userRelation, resultTotal),
    };
  }

  mergeRelationUser = (followingIds, users) => {
    this.logger.log('merge relation and user.');
    const relationUsers = [];
    followingIds.map((f) => {
      const user = users.find((u) => String(u.id) === String(f.userId));
      if (user) {
        delete user['id'];
        relationUsers.push({
          ...f,
          ...user,
        });
      }
    });
    return relationUsers;
  };

  /**
   * Deactivate accounts, users and related items
   * @param {Account} account
   */
  deactivate = async (account: Account) => {
    const users = await this._userModel.find({ ownerAccount: account._id });

    try {
      const deactivateResults = await Promise.all([
        this.removeAllAccountAuthenIdsFromAccount(account),
        this.removeAllAccountActivationsFromAccount(account),
        this.removeAllAccountReferralFromAccount(account),
        this.removeAllCommentsFromUsers(users),
        this.removeAllContentsFromUsers(users),
        this.removeAllEngagementsFromUsers(users),
        this.removeAllPagesAndUsersFromAccount(account),
        this.removeAllRelationshipsFromUsers(users),
        this.removeReferralCountParentAccountFromAccount(account),
      ]);

      this.logger.log(
        JSON.stringify(deactivateResults),
        `deactivate:success:account-${account._id}`,
      );
    } catch (error: unknown) {
      this.logger.error(error, `deactivate:error:account-${account._id}`);
      throw error;
    }
  };

  removeReferralCountParentAccountFromAccount = (account: Account) => {
    return this._accountModel.updateOne(
      { _id: account.referralBy },
      { $inc: { referralCount: -1 } },
    );
  };

  removeAllAccountAuthenIdsFromAccount = (account: Account) => {
    return this._accountAuthenId.deleteMany({ account: account._id });
  };

  removeAllAccountActivationsFromAccount = async (account: Account) => {
    return await Promise.all([
      this.activationModel.updateMany(
        { account: account._id },
        { visibility: EntityVisibility.Deleted },
      ),
      this._accountModel.updateMany(
        { account: account._id },
        { 'activations.$.visibility': EntityVisibility.Deleted },
      ),
    ]);
  };

  removeAllAccountReferralFromAccount = (account: Account) => {
    return this._accountReferral.updateMany(
      { $or: [{ referrerAccount: account }, { referringAccount: account }] },
      { visibility: EntityVisibility.Deleted },
    );
  };

  removeAllCommentsFromUsers = (users: User[]) => {
    return this.commentModel.updateMany(
      { 'author._id': { $in: users.map((user) => user._id) } },
      { visibility: EntityVisibility.Deleted },
    );
  };

  removeAllContentsFromUsers = async (users: User[]) => {
    const contents = await this.contentModel.find({
      'author.id': { $in: users.map((user) => user._id) },
    });

    const hashtags: string[] = [];
    const $deletedContents = contents.map((content) => {
      hashtags.push(...(content.hashtags || []));

      return content.set({ visibility: EntityVisibility.Deleted }).save();
    });

    return Promise.all<UpdateWriteOpResult | Content>([
      this.hashtagModel.updateMany(
        { tag: { $in: hashtags }, score: { $gt: 0 } },
        { $inc: { score: -1 } },
      ),
      ...$deletedContents,
    ]);
  };

  removeAllEngagementsFromUsers = async (users: User[]) => {
    const engagements = await this.engagementModel.find({
      user: { $in: users.map((user) => user._id) },
      visibility: { $ne: EntityVisibility.Deleted },
    });

    const $deletedEngagements = engagements.map((engagement) => {
      return engagement.set({ visibility: EntityVisibility.Deleted }).save();
    });

    return Promise.all($deletedEngagements);
  };

  removeAllPagesAndUsersFromAccount = (account: Account) => {
    return Promise.all([
      this._accountModel.updateOne(
        { _id: account._id },
        { visibility: EntityVisibility.Deleted },
      ),
      this._userModel.updateMany(
        { ownerAccount: account._id },
        { visibility: EntityVisibility.Deleted },
      ),
    ]);
  };

  removeAllRelationshipsFromUsers = (users: User[]) => {
    return this._relationshipModel.updateMany(
      {
        $or: [{ user: { $in: users } }, { followedUser: { $in: users } }],
      },
      { visibility: EntityVisibility.Deleted },
    );
  };

  reactivate = async (user: User) => {
    user.visibility = EntityVisibility.Publish;

    if (user.type === UserType.PAGE) return user.save();

    await this._userModel.updateMany({
      ownerAccount: user.ownerAccount,
      type: UserType.PAGE,
      visibility: EntityVisibility.Publish,
    });

    await this._accountModel.updateOne(
      { _id: user.ownerAccount },
      { visibility: EntityVisibility.Publish },
    );

    return user.save();
  };

  /**
   * Get all user,pages that could get from the system sort by followerCount
   * @param {User} user
   * @param {string} keyword
   * @param {CastcleQueryOptions} queryOption
   * @param {boolean} hasRelationshipExpansion
   * @returns {Promise<{users:User[], pagination:Pagination}>}
   */
  getMentionsFromPublic = async (
    user: User,
    keyword: string,
    queryOption: CastcleQueryOptions,
    hasRelationshipExpansion = false,
    excludeUserId?: Types.ObjectId[],
  ) => {
    const query = {
      displayId: { $regex: new RegExp('^' + keyword.toLowerCase(), 'i') },
      _id: { $nin: excludeUserId },
    };

    queryOption.sortBy = {
      field: 'followerCount',
      type: SortDirection.DESC,
    };

    return this.getByCriteria(
      user,
      query,
      queryOption,
      hasRelationshipExpansion,
    );
  };

  /**
   * Get user,pages from following user with filter
   * @param {User} user
   * @param {string} keyword
   * @param {CastcleQueryOptions} queryOption
   * @param {boolean} hasRelationshipExpansion
   * @returns {Promise<{users:User[], pagination:Pagination}>}
   */
  getMentionsFollowing = async (
    user: User,
    keyword: string,
    queryOption: CastcleQueryOptions,
    hasRelationshipExpansion = false,
  ) => {
    const pipeline = pipelineOfUserRelationMentions({
      userId: user._id,
      keyword: keyword,
      limit: queryOption.limit,
    });

    this.logger.log(
      JSON.stringify(pipeline),
      ' getUserRelationSearch:aggregate',
    );
    const userRelation =
      await this._relationshipModel.aggregate<GetUserRelationResponse>(
        pipeline,
      );

    const followingUsersId = userRelation.flatMap((u) =>
      u.user_relation.flatMap((r) => mongoose.Types.ObjectId(r._id)),
    );

    const query = {
      _id: { $in: followingUsersId },
    };

    this.logger.log('get user from following list');
    const userData = await this.getByCriteria(
      user,
      query,
      queryOption,
      hasRelationshipExpansion,
    );
    return {
      followingUserId: followingUsersId,
      userData: userData,
    };
  };

  async blockUser(user: User, blockedUser?: User) {
    if (!blockedUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    await Promise.all([
      this._relationshipModel
        .updateOne(
          { user: user._id, followedUser: blockedUser._id },
          {
            $setOnInsert: {
              user: user._id,
              followedUser: blockedUser._id,
              visibility: EntityVisibility.Publish,
              following: false,
              blocked: false,
            },
            $set: { blocking: true },
          },
          { upsert: true },
        )
        .exec(),
      this._relationshipModel
        .updateOne(
          { followedUser: user._id, user: blockedUser._id },
          {
            $setOnInsert: {
              user: blockedUser._id,
              followedUser: user._id,
              visibility: EntityVisibility.Publish,
              following: false,
              blocking: false,
            },
            $set: { blocked: true },
          },
          { upsert: true },
        )
        .exec(),
    ]);
  }

  async unblockUser(user: User, unblockedUser: User) {
    if (!unblockedUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    await Promise.all([
      this._relationshipModel
        .updateOne(
          {
            user: user._id,
            followedUser: unblockedUser._id,
            blocking: true,
          },
          { $set: { blocking: false } },
        )
        .exec(),
      this._relationshipModel
        .updateOne(
          {
            followedUser: user._id,
            user: unblockedUser._id,
            blocked: true,
          },
          { $set: { blocked: false } },
        )
        .exec(),
    ]);
  }

  async reportUser(user: User, reportedUser: User, message: string) {
    if (!reportedUser) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const mail = await this.transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: `Report user: ${reportedUser._id}`,
      to: Environment.SMTP_ADMIN_EMAIL,
      text: `User ${reportedUser.displayName} (${reportedUser._id}) has been reported.
Reported by: ${user.displayName} (${user._id})
Message: ${message}`,
    });

    this.logger.log(`Report has been submitted ${mail.messageId}`);
  }

  updateMobile = async (
    user: User,
    accountId: string,
    countryCode: string,
    mobileNumber: string,
  ) => {
    const account = await this._accountModel.findById(accountId);

    user.set({ 'verified.mobile': true });
    account.set({
      'mobile.countryCode': countryCode,
      'mobile.number': mobileNumber,
    });

    await Promise.all([account.save(), user.save()]);
    this.logger.log('Update user mobile successfully');
  };

  userSettings = async (accountId: string, languageCode: string[]) => {
    await this._accountModel
      .updateOne(
        { _id: accountId },
        {
          preferences: {
            languages: languageCode,
          },
        },
      )
      .exec();
  };

  getIncludesUsers = async (
    viewerAccount: Account,
    authors: Author[],
    hasRelationshipExpansion = false,
  ) => {
    const viewer = await this._userModel.findOne({
      ownerAccount: viewerAccount._id,
    });

    const authorIds = authors.map(({ id }) => id as any);
    const users = await this._userModel.find({ _id: { $in: authorIds } });
    const relationships = hasRelationshipExpansion
      ? await this._relationshipModel.find({
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

      const authorRelationship = relationships.find(
        ({ followedUser, user }) =>
          String(user) === String(author.id) &&
          String(followedUser) === String(viewer?.id),
      );

      const getterRelationship = relationships.find(
        ({ followedUser, user }) =>
          String(followedUser) === String(author.id) &&
          String(user) === String(viewer?.id),
      );

      const blocked = Boolean(getterRelationship?.blocking);
      const blocking = Boolean(authorRelationship?.blocking);
      const followed = Boolean(getterRelationship?.following);

      return new Author(author).toIncludeUser({ blocked, blocking, followed });
    });
  };

  getRelationshipData = async (
    hasRelationshipExpansion: boolean,
    relationUserId: any[],
    viewerId: string,
  ) => {
    return hasRelationshipExpansion
      ? await this._relationshipModel.find({
          $or: [
            {
              user: viewerId as any,
              followedUser: { $in: relationUserId },
            },
            {
              user: { $in: relationUserId },
              followedUser: viewerId as any,
            },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];
  };

  getReferrer = async (accountId: Account) => {
    const accountRef = await this._accountReferral
      .findOne({
        referringAccount: accountId,
      })
      .exec();

    if (accountRef) {
      const userRef = this.getByIdOrCastcleId(
        accountRef.referrerDisplayId,
        UserType.PEOPLE,
      );
      this.logger.log('Success get referrer.');
      return userRef;
    } else {
      this.logger.warn('Referrer not found!');
      return null;
    }
  };

  getReferee = async (
    accountId: Account,
    maxResults: number,
    sinceId?: string,
    untilId?: string,
  ) => {
    let filter: FilterQuery<AccountReferral> = {
      referrerAccount: accountId,
    };
    filter = await createCastcleFilter(filter, {
      sinceId: sinceId,
      untilId: untilId,
    });
    this.logger.log('Get referee.');
    const accountReferee = await this._accountReferral
      .find(filter)
      .limit(maxResults)
      .exec();
    const totalDocument = await this._accountReferral
      .countDocuments(filter)
      .exec();

    const result: User[] = [];
    this.logger.log('Get user.');
    await Promise.all(
      accountReferee?.map(async (x) =>
        result.push(
          await (
            await this.getUserFromAccountId(x.referringAccount._id)
          ).user,
        ),
      ),
    );
    this.logger.log('Success get referee.');

    return {
      total: totalDocument,
      items: result,
    };
  };

  /**
   * Upload any image in s3 and transform UpdateUserDto to UpdateModelUserDto
   * @param {UpdateUserDto} body
   * @param {CredentialRequest} req
   * @returns {UpdateModelUserDto}
   */
  async uploadUserInfo(
    body: UpdateUserDto,
    accountId: string,
  ): Promise<UpdateModelUserDto> {
    this.logger.debug(`uploading info avatar-${accountId}`);
    this.logger.debug(body);

    const images: UserImage = {};

    if (body.images?.avatar) {
      const avatar = await Image.upload(body.images.avatar as string, {
        filename: `avatar-${accountId}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `account_${accountId}`,
      });

      images.avatar = avatar.image;
      this.logger.debug('after update', images);
    }

    if (body.images?.cover) {
      const cover = await Image.upload(body.images.cover as string, {
        filename: `cover-${accountId}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `account_${accountId}`,
      });

      images.cover = cover.image;
    }

    return { ...body, images };
  }

  /**
   * Create new page with sync social
   * @param {Account} account
   * @param {SocialPageDto} socialPageDto
   * @returns {User}
   */
  createPageFromSocial = (account: Account, socialPageDto: SocialPageDto) => {
    return new this._userModel({
      ownerAccount: account._id,
      type: UserType.PAGE,
      displayId: socialPageDto.castcleId,
      displayName: socialPageDto.displayName,
      profile: {
        overview: socialPageDto.overview,
        images: {
          avatar: socialPageDto.avatar,
          cover: socialPageDto.cover,
        },
        socials: {
          facebook: socialPageDto.links?.facebook,
          twitter: socialPageDto.links?.twitter,
          youtube: socialPageDto.links?.youtube,
          medium: socialPageDto.links?.medium,
        },
      },
    }).save();
  };
  /**
   * Update page with sync social
   * @param {Account} account
   * @param {SocialPageDto} socialPageDto
   * @returns {User}
   */
  updatePageFromSocial = async (page: User, socialPageDto: SocialPageDto) => {
    const updatePage = await this._userModel.findById(page.id);

    if (socialPageDto.displayName) {
      updatePage.set({ displayName: socialPageDto.displayName });
    }
    if (socialPageDto.overview) {
      updatePage.set({ 'profile.overview': socialPageDto.overview });
    }
    if (socialPageDto.avatar) {
      updatePage.set({
        'profile.images.avatar': socialPageDto.avatar,
      });
    }
    if (socialPageDto.cover) {
      updatePage.set({
        'profile.images.cover': socialPageDto.cover,
      });
    }
    if (socialPageDto.links) {
      if (socialPageDto.links.facebook)
        updatePage.set({
          'profile.socials.facebook': socialPageDto.links.facebook,
        });
      if (socialPageDto.links.medium)
        updatePage.set({
          'profile.socials.facebook': socialPageDto.links.medium,
        });
      if (socialPageDto.links.twitter)
        updatePage.set({
          'profile.socials.facebook': socialPageDto.links.twitter,
        });
      if (socialPageDto.links.youtube)
        updatePage.set({
          'profile.socials.facebook': socialPageDto.links.youtube,
        });
    }
    return updatePage.save();
  };
}
