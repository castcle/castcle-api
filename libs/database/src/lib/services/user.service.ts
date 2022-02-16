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
import { UserMessage, UserProducer } from '@castcle-api/utils/queue';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { FilterQuery, Model } from 'mongoose';
import { createTransport } from 'nodemailer';
import { GetBalanceResponse, pipelineOfGetBalance } from '../aggregations';
import {
  Author,
  CastcleQueryOptions,
  CastcleQueueAction,
  createFilterQuery,
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
  UserModelImage,
} from '../dtos';
import { CastcleNumber } from '../models';
import {
  Account,
  AccountAuthenId,
  AccountReferral,
  Content,
  Credential,
  Relationship,
  SocialSync,
  Transaction,
  User,
  UserType,
} from '../schemas';
import { createCastcleFilter, createPagination } from '../utils/common';
import { ContentService } from './content.service';

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
    @InjectModel('AccountReferral')
    public _accountReferral: Model<AccountReferral>,
    @InjectModel('Credential')
    public _credentialModel: Model<Credential>,
    @InjectModel('Relationship')
    public _relationshipModel: Model<Relationship>,
    @InjectModel('User')
    public _userModel: Model<User>,
    @InjectModel('AccountAuthenId')
    public _accountAuthenId: Model<AccountAuthenId>,
    @InjectModel('SocialSync')
    private _socialSyncModel: Model<SocialSync>,
    @InjectModel('Transaction')
    private transactionModel: Model<Transaction>,
    private contentService: ContentService,
    private userProducer: UserProducer
  ) {}

  getUserFromCredential = (credential: Credential) =>
    this._userModel
      .findOne({
        ownerAccount: credential?.account?._id,
        type: UserType.People,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  getPagesFromCredential = (credential: Credential) =>
    this._userModel
      .find({
        ownerAccount: credential.account._id,
        type: UserType.Page,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  getPagesFromAccountId = (accountId: string) =>
    this._userModel
      .find({
        ownerAccount: accountId as any,
        type: UserType.Page,
        visibility: EntityVisibility.Publish,
      })
      .exec();

  /**
   * Get user's balance
   * @param {User} user
   */
  getBalance = async (user: User) => {
    const [balance] = await this.transactionModel.aggregate<GetBalanceResponse>(
      pipelineOfGetBalance(String(user.ownerAccount))
    );

    return CastcleNumber.from(balance?.total?.toString()).toNumber();
  };

  getUserFromAccountId = async (
    accountId: string,
    userFields?: UserField[]
  ) => {
    const account = await this._accountModel.findById(accountId).exec();
    const user = await this._userModel
      .findOne({
        ownerAccount: accountId as any,
        type: UserType.People,
        visibility: EntityVisibility.Publish,
      })
      .exec();

    if (!account || !user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const balance = userFields?.includes(UserField.Wallet)
      ? await this.getBalance(user)
      : undefined;

    const authenSocial = userFields?.includes(UserField.LinkSocial)
      ? await this._accountAuthenId.find({ account: accountId as any }).exec()
      : undefined;

    let syncPage = undefined;
    if (userFields?.includes(UserField.SyncSocial)) {
      const page = await this.getPagesFromAccountId(accountId);
      syncPage = (
        await Promise.all(
          page.map(async (p) => {
            return await this._socialSyncModel
              .find({ 'author.id': p.id })
              .exec();
          })
        )
      ).flat();
    }

    return {
      user: user,
      account: account,
      balance: balance,
      authenSocial: authenSocial,
      syncPage: syncPage,
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
    hasRelationshipExpansion = false
  ) {
    if (!hasRelationshipExpansion) {
      return Promise.all(
        users.map(async (user) => {
          return user.type === UserType.Page
            ? user.toPageResponse()
            : await user.toUserResponse();
        })
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
      users.map(async (user) => {
        const userResponse =
          user.type === UserType.Page
            ? user.toPageResponse()
            : await user.toUserResponse();

        const targetRelationship = relationships.find(
          ({ followedUser, user }) =>
            String(user) === String(user.id) &&
            String(followedUser) === String(viewer?.id)
        );

        const getterRelationship = relationships.find(
          ({ followedUser, user }) =>
            String(followedUser) === String(user.id) &&
            String(user) === String(viewer?.id)
        );

        userResponse.blocked = Boolean(getterRelationship?.blocking);
        userResponse.blocking = Boolean(targetRelationship?.blocking);
        userResponse.followed = Boolean(getterRelationship?.following);

        return userResponse;
      })
    );
  }

  getById = async (
    user: User,
    id: string,
    type?: UserType,
    hasRelationshipExpansion = false
  ) => {
    const targetUser = await this.getByIdOrCastcleId(id, type);

    if (!targetUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const [userResponse] = await this.convertUsersToUserResponses(
      user,
      [targetUser],
      hasRelationshipExpansion
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
    }: GetSearchUsersDto
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
      hasRelationshipExpansion
    );
  }

  async getBlockedUsers(
    user: User,
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery
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
      hasRelationshipExpansion
    );
  }

  getByCriteria = async (
    user: User,
    query: FilterQuery<User>,
    queryOptions?: CastcleQueryOptions,
    hasRelationshipExpansion = false
  ) => {
    const {
      items: targetUsers,
      pagination,
      meta,
    } = await this.getAllByCriteria(query, queryOptions);

    const users = await this.convertUsersToUserResponses(
      user,
      targetUsers,
      hasRelationshipExpansion
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

    if (!user) throw CastcleException.REQUEST_URL_NOT_FOUND;

    return user;
  };

  updateUser = (user: User, updateUserDto: UpdateModelUserDto) => {
    if (!user.profile) user.profile = {};
    if (updateUserDto.overview) user.profile.overview = updateUserDto.overview;
    if (updateUserDto.dob) user.profile.birthdate = updateUserDto.dob;
    if (updateUserDto.images) {
      if (!user.profile.images) user.profile.images = {};
      if (updateUserDto.images.avatar)
        user.profile.images.avatar = updateUserDto.images.avatar;
      if (updateUserDto.images.cover)
        user.profile.images.cover = updateUserDto.images.cover;
    }
    if (updateUserDto.links) {
      if (!user.profile.socials) user.profile.socials = {};
      const socialNetworks = ['facebook', 'medium', 'twitter', 'youtube'];
      socialNetworks.forEach((social) => {
        if (updateUserDto.links[social])
          user.profile.socials[social] = updateUserDto.links[social];
        if (updateUserDto.links.website)
          user.profile.websites = [
            {
              website: updateUserDto.links.website,
              detail: updateUserDto.links.website,
            },
          ];
      });
    }
    user.markModified('profile');
    console.debug('saving dto', updateUserDto);
    console.debug('saving website', user.profile.websites);
    console.debug('saving user', user);
    this.userProducer.sendMessage({
      id: user._id,
      action: CastcleQueueAction.UpdateProfile,
    });

    return user.save();
  };

  updateUserInEmbedContent = async (user: User) => {
    console.debug('updating contents of user');
    await this.contentService._contentModel
      .updateMany({ 'author.id': user._id }, { author: user.toAuthor() })
      .exec();
    console.debug('updating comments of user');
    await this.contentService._commentModel
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
    pageDto: PageDto
  ) => {
    const user = await this.getUserFromCredential(credential);
    return this.createPageFromUser(user, pageDto);
  };

  createPageFromUser = (user: User, pageDto: PageDto) => {
    const newPage = new this._userModel({
      ownerAccount: user.ownerAccount,
      type: UserType.Page,
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
    queryOptions?: CastcleQueryOptions
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
    return this.getAllByCriteria({ type: UserType.Page }, queryOptions);
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
      type: UserType.Page,
      visibility: EntityVisibility.Publish,
    };
    const pages = this._userModel.find(filter).skip(queryOptions.page - 1);
    //.limit(queryOptions.limit); TODO !!! hack
    const pagination = createPagination(
      queryOptions,
      await this._userModel.countDocuments(filter)
    );
    let items: User[];
    if (queryOptions.sortBy.type === 'desc')
      items = await pages.sort(`-${queryOptions.sortBy.field}`).exec();
    else items = await pages.sort(`${queryOptions.sortBy.field}`).exec();
    return { items, pagination };
  };

  /**
   *
   * @param {User} user
   * @param {User} followedUser
   * @returns {Promise<void>}
   */
  follow = async (user: User, followedUser: User) => {
    this.userProducer.sendMessage({
      id: user._id,
      action: CastcleQueueAction.CreateFollowFeedItem,
      options: {
        followedId: followedUser._id,
      },
    });
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
    paginationQuery: PaginationQuery,
    sortBy?: SortBy,
    userType?: string
  ) => {
    const query: FilterQuery<Relationship> = {
      followedUser: targetUser.id as any,
      visibility: EntityVisibility.Publish,
      following: true,
    };

    return this.searchRelation(
      query,
      viewer,
      'user',
      paginationQuery,
      sortBy,
      userType
    );
  };

  getFollowing = async (
    viewer: User,
    targetUser: User,
    paginationQuery: PaginationQuery,
    sortBy?: SortBy,
    userType?: string
  ) => {
    const query: FilterQuery<Relationship> = {
      user: targetUser.id as any,
      visibility: EntityVisibility.Publish,
      following: true,
    };

    return this.searchRelation(
      query,
      viewer,
      'followedUser',
      paginationQuery,
      sortBy,
      userType
    );
  };

  private async searchRelation(
    query: FilterQuery<Relationship>,
    viewer: User,
    populate: string,
    paginationQuery: PaginationQuery,
    sortBy?: SortBy,
    userType?: string
  ) {
    const direction = sortBy?.type === 'asc' ? '' : '-';
    const sortField = sortBy?.field ? sortBy?.field : 'createdAt';

    query = await createCastcleFilter(query, {
      sinceId: paginationQuery?.sinceId,
      untilId: paginationQuery?.untilId,
    });

    if (userType) {
      query.isFollowPage = userType === UserType.Page;
    }

    const total = await this._relationshipModel.countDocuments(query).exec();
    const relationships = total
      ? await this._relationshipModel
          .find(query)
          .limit(paginationQuery.maxResults)
          .populate(populate)
          .sort(`${direction}${sortField}`)
          .exec()
      : [];

    const followingIds =
      populate === 'user'
        ? relationships.map(({ user }) => user._id)
        : relationships.map(({ followedUser }) => followedUser._id);

    const hasRelationship = paginationQuery.hasRelationshipExpansion;
    const { users } = await this.getByCriteria(
      viewer,
      {
        _id: { $in: followingIds },
      },
      undefined,
      hasRelationship
    );

    return {
      users,
      meta: Meta.fromDocuments(relationships, total),
    };
  }

  /**
   * TODO !!! need to find a way to put in transaction
   * Deactivate User account
   * @param {User} user
   * @returns {User}
   */
  deactive = async (user: User) => {
    //all page from user has to be delete
    if (user.type === UserType.People) {
      //check if he has a page;
      //each page has to be deactivated
      const pages = await this._userModel
        .find({ ownerAccount: user.ownerAccount, type: UserType.Page })
        .exec();
      const promiseDeactivatePages = pages.map((p) => this.deactive(p));
      await Promise.all(promiseDeactivatePages);
      //all content from page of user has to be delete
    }
    user.visibility = EntityVisibility.Deleted;
    const userResult = user.save();
    //deactive userAccount
    if (user.type === UserType.People) {
      await this._accountModel.updateOne(
        { _id: user.ownerAccount },
        {
          visibility: EntityVisibility.Deleted,
          queueAction: CastcleQueueAction.Deleting,
        }
      );
      this.userProducer.sendMessage({
        id: user.ownerAccount,
        action: CastcleQueueAction.Deleting,
      } as UserMessage);
    }
    return userResult;
  };

  /**
   * get all user account this this account is owned;
   * @param {Account} account
   * @returns {User[]}
   */
  _getAllUserFromAccount = (account: Account) =>
    this._userModel.find({ ownerAccount: account._id }).exec();

  /**
   * flag all contents that this user has create to deleted // this will update the engagement recast/quotecast to -1 if it was recast or quotecast
   * @param {User} user
   * @returns {Content[]}
   */
  _removeAllContentFromUser = async (user: User): Promise<Content[]> => {
    const contents = await this.contentService._contentModel
      .find({ 'author.id': user._id })
      .exec();
    const promiseRemoveContents: Promise<Content>[] = contents.map(
      (contentItem) => this.contentService.deleteContentFromId(contentItem._id)
    );
    return Promise.all(promiseRemoveContents);
  };

  _removeAllCommentFromUser = async (user: User) => {
    const comments = await this.contentService._commentModel
      .find({ 'author._id': user._id })
      .exec();
    console.log('allcomment from user', comments);
    return Promise.all(
      comments.map(async (comment) => {
        comment.visibility = EntityVisibility.Hidden;
        const result = await comment.save();
        console.log('resultRemoveComment', result);
        return this.contentService._updateCommentCounter(result);
      })
    );
  };

  /**
   * update engagements flag of this user to hidden this should invoke engagement.post('save') to update like counter
   * @param {User} user
   * @returns {Engagement[]}
   */
  _removeAllEngagements = async (user: User) => {
    const engagements = await this.contentService._engagementModel
      .find({ user: user._id, visibility: EntityVisibility.Publish })
      .exec();
    const promiseHideEngagements = engagements.map(async (engagement) => {
      engagement.visibility = EntityVisibility.Hidden;
      return engagement.save();
    });
    return Promise.all(promiseHideEngagements);
  };

  /**
   * Update all follower account count to 0
   * @param user
   */
  _removeAllFollower = async (user: User) => {
    const relationships = await this._relationshipModel
      .find({ user: user._id, blocking: false, following: true })
      .exec();
    console.log('relationships', relationships);
    //make all relationship hidden
    return await this._relationshipModel
      .updateMany({ user: user._id }, { visibility: EntityVisibility.Hidden })
      .exec();
  };

  /**
   * get all user form account and removeAll content, engagement and followers
   * @param account
   */
  _deactiveAccount = async (account: Account) => {
    await Promise.all(
      await this._getAllUserFromAccount(account).then((users) =>
        users.map(async (user) => {
          await this._removeAllContentFromUser(user);
          await this._removeAllEngagements(user);
          await this._removeAllFollower(user);
          await this._removeAllCommentFromUser(user);
          return user;
        })
      )
    );
    //update queueAction to deleted
    await this._accountModel
      .updateOne(
        { _id: account._id },
        {
          queueAction: CastcleQueueAction.Deleted,
          visibility: EntityVisibility.Deleted,
        }
      )
      .exec();
  };

  /**
   * Deactivate one account by id
   * @param id
   */
  deactiveBackground = async (accountId: any) => {
    const account = await this._accountModel.findById(accountId).exec();
    await this._deactiveAccount(account);
  };

  /**
   * Deactvate all account that has been flag as Deleting
   */
  deactiveQueue = async () => {
    //get all account that is in the delete queue
    const accounts = await this._accountModel
      .find({ queueAction: CastcleQueueAction.Deleting })
      .exec();
    accounts.forEach(async (account) => {
      await this._deactiveAccount(account);
    });
  };

  reactive = async (user: User) => {
    //all page from user has to be delete
    if (user.type === UserType.People) {
      //check if he has a page;
      //each page has to be deactivated
      const pages = await this._userModel
        .find({ ownerAccount: user.ownerAccount, type: UserType.Page })
        .exec();
      const promiseReactivatePages = pages.map((p) => this.reactive(p));
      await Promise.all(promiseReactivatePages);
      //all content from page of user has to be delete
    }
    //TODO !!! will move this logic to queue
    /*
    //all content form user has to be delete
    //TODO !!! this should move to cron or something to do at background and add pagination
    const contents = await this.contentService._contentModel
      .find({ 'author.id': user._id })
      .exec();
    const promiseReactiveContents: Promise<Content>[] = contents.map(
      (contentItem) => this.contentService.recoverContentFromId(contentItem._id)
    );
    await Promise.all(promiseReactiveContents);

    //remove all engagements (like) Aggregator that this user do (quote/requote agg) already remove with deleteContentFromId()
    //TODO !!! need to improve performance by bypass the engagement save hook and use updateMany instead
    // but need to find a way to get all engagement contents to be more effective
    const engagements = await this.contentService._engagementModel
      .find({ user: user._id, visibility: EntityVisibility.Publish })
      .exec();
    const promisePublishEngagements = engagements.map((engagement) => {
      engagement.visibility = EntityVisibility.Publish;
      return engagement.save();
    });
    await Promise.all(promisePublishEngagements);
    //update follower / followee aggregator
    const relationships = await this._relationshipModel
      .find({ user: user._id })
      .populate('followedUser')
      .exec();
    //TODO !!! need to improve performance
    const promiseUpdateFollower = relationships.map((r) =>
      this._userModel
        .updateOne(r._id, {
          $inc: {
            followerCount: 1
          }
        })
        .exec()
    );
    await Promise.all(promiseUpdateFollower);
    */
    //change status to delete
    user.visibility = EntityVisibility.Publish;
    //deactive userAccount
    if (user.type === UserType.People)
      await this._accountModel.updateOne(
        { _id: user.ownerAccount },
        {
          visibility: EntityVisibility.Publish,
        }
      );
    return user.save();
  };

  /**
   * Get all user,pages that could get from the system sort by followerCount
   * @param {string} keyword
   * @param {CastcleQueryOptions} queryOption
   * @returns {Promise<{users:User[], pagination:Pagination}>}
   */
  getMentionsFromPublic = async (
    user: User,
    keyword: string,
    queryOption: CastcleQueryOptions
  ) => {
    const query = {
      displayId: { $regex: new RegExp('^' + keyword.toLowerCase(), 'i') },
    };

    queryOption.sortBy = {
      field: 'followerCount',
      type: SortDirection.DESC,
    };

    return this.getByCriteria(user, query, queryOption);
  };

  async blockUser(user: User, blockedUser?: User) {
    if (!blockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const relationship = {
      user: user._id,
      followedUser: blockedUser._id,
      visibility: EntityVisibility.Publish,
      following: false,
    };

    await this._relationshipModel
      .updateOne(
        { user: user._id, followedUser: blockedUser._id },
        { $setOnInsert: relationship, $set: { blocking: true } },
        { upsert: true }
      )
      .exec();
  }

  async unblockUser(user: User, unblockedUser: User) {
    if (!unblockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const relationship = await this._relationshipModel
      .findOne({
        user: user._id,
        followedUser: unblockedUser._id,
        blocking: true,
      })
      .exec();

    if (!relationship) return;

    relationship.blocking = false;
    await relationship.save();
  }

  async reportUser(user: User, reportedUser: User, message: string) {
    if (!reportedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

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
    mobileNumber: string
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
        }
      )
      .exec();
  };

  getIncludesUsers = async (viewerAccount: Account, authors: Author[]) => {
    const viewer = await this._userModel.findOne({
      ownerAccount: viewerAccount._id,
    });

    const authorIds = authors.map(({ id }) => id as any);
    const relationships = await this._relationshipModel.find({
      $or: [
        { user: viewer?._id, followedUser: { $in: authorIds } },
        { user: { $in: authorIds }, followedUser: viewer?._id },
      ],
      visibility: EntityVisibility.Publish,
    });

    return authors.map((author) => {
      const authorRelationship = relationships.find(
        ({ followedUser, user }) =>
          String(user) === String(author.id) &&
          String(followedUser) === String(viewer?.id)
      );

      const getterRelationship = relationships.find(
        ({ followedUser, user }) =>
          String(followedUser) === String(author.id) &&
          String(user) === String(viewer?.id)
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
    viewerId: string
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
        UserType.People
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
    untilId?: string
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
          ).user
        )
      )
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
    accountId: string
  ): Promise<UpdateModelUserDto> {
    this.logger.debug(`uploading info avatar-${accountId}`);
    this.logger.debug(body);

    const images: UserModelImage = {};

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
      type: UserType.Page,
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
}
