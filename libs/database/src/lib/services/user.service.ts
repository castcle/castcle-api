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
import { CastcleException } from '@castcle-api/utils/exception';
import { UserMessage, UserProducer } from '@castcle-api/utils/queue';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import { FilterQuery, Model, Types } from 'mongoose';
import { createTransport } from 'nodemailer';
import { CastcleQueryOptions } from '../dtos';
import {
  CastcleQueueAction,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility
} from '../dtos/common.dto';
import { PageModelDto, UpdateModelUserDto } from '../dtos/user.dto';
import { CredentialDocument, CredentialModel } from '../schemas';
import { AccountDocument } from '../schemas/account.schema';
import { ContentDocument } from '../schemas/content.schema';
import { RelationshipDocument } from '../schemas/relationship.schema';
import { UserDocument, UserModel, UserType } from '../schemas/user.schema';
import { createPagination } from '../utils/common';
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
      pass: Environment.SMTP_PASSWORD
    }
  });

  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('User')
    public _userModel: UserModel,
    @InjectModel('Relationship')
    public _relationshipModel: Model<RelationshipDocument>,
    private contentService: ContentService,
    private userProducer: UserProducer
  ) {}

  getUserFromCredential = (credential: CredentialDocument) =>
    this._userModel
      .findOne({
        ownerAccount: credential.account._id,
        type: UserType.People,
        visibility: EntityVisibility.Publish
      })
      .exec();

  /**
   * Get all user and page that this credentials is own
   * @param credential
   * @returns {UserDocument[]}
   */
  getUserAndPagesFromCredential = (credential: CredentialDocument) =>
    this._userModel
      .find({
        ownerAccount: credential.account._id,
        visibility: EntityVisibility.Publish
      })
      .exec();

  getUserFromId = (id: string) => {
    try {
      if (Types.ObjectId(id)) {
        return this._userModel
          .findOne({
            _id: id,
            visibility: EntityVisibility.Publish
          })
          .exec();
      } else return null;
    } catch (error) {
      return null;
    }
  };

  getUserFromIdOrCastcleId = (id: string) => {
    return this._userModel
      .findOne({
        [isMongoId(id) ? '_id' : 'displayId']: id,
        visibility: EntityVisibility.Publish
      })
      .exec();
  };

  updateUser = (user: UserDocument, updateUserDto: UpdateModelUserDto) => {
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
              detail: updateUserDto.links.website
            }
          ];
      });
    }
    user.markModified('profile');
    console.debug('saving dto', updateUserDto);
    console.debug('saving website', user.profile.websites);
    console.debug('saving user', user);
    this.userProducer.sendMessage({
      id: user._id,
      action: CastcleQueueAction.UpdateProfile
    });

    return user.save();
  };

  updateUserInEmbedContent = async (user: UserDocument) => {
    console.debug('updating contents of user');
    await this.contentService._contentModel
      .updateMany({ 'author.id': user._id }, { author: user.toAuthor() })
      .exec();
    console.debug('updating comments of user');
    await this.contentService._commentModel
      .updateMany({ 'author._id': user._id }, { author: user })
      .exec();
    console.debug('updating feedItem of user');
    await this.contentService._feedItemModel.updateMany(
      { 'content.author.id': user._id },
      { 'content.author': user.toAuthor() }
    );
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
    credential: CredentialDocument,
    pageDto: PageModelDto
  ) => {
    const user = await this.getUserFromCredential(credential);
    return this.createPageFromUser(user, pageDto);
  };

  createPageFromUser = (user: UserDocument, pageDto: PageModelDto) => {
    const newPage = new this._userModel({
      ownerAccount: user.ownerAccount,
      type: UserType.Page,
      displayId: pageDto.castcleId,
      displayName: pageDto.displayName
    });
    return newPage.save();
  };

  /**
   * get all pages
   * @param {CastcleQueryOptions} queryOptions
   * @returns {Promise<{items:UserDocument[], pagination:Pagination}>}
   */
  getAllPages = async (queryOptions: CastcleQueryOptions) => {
    const pagination = createPagination(
      queryOptions,
      await this._userModel.count({ type: UserType.Page })
    );
    const itemsQuery = this._userModel
      .find({ type: UserType.Page, visibility: EntityVisibility.Publish })
      .skip(queryOptions.page - 1)
      .limit(queryOptions.limit);
    let items: UserDocument[];
    if (queryOptions.sortBy.type === 'desc')
      items = await itemsQuery.sort(`-${queryOptions.sortBy.field}`).exec();
    else items = await itemsQuery.sort(`${queryOptions.sortBy.field}`).exec();
    return { items, pagination };
  };

  /**
   * Get all user pages
   * @param {UserDocument} user
   * @param {CastcleQueryOptions} queryOptions
   * @returns {Promise<{items:UserDocument[], pagination:Pagination}>}
   */
  getUserPages = async (
    user: UserDocument,
    queryOptions: CastcleQueryOptions
  ) => {
    const filter = {
      ownerAccount: user.ownerAccount,
      type: UserType.Page,
      visibility: EntityVisibility.Publish
    };
    const pages = this._userModel.find(filter).skip(queryOptions.page - 1);
    //.limit(queryOptions.limit); TODO !!! hack
    const pagination = createPagination(
      queryOptions,
      await this._userModel.countDocuments(filter)
    );
    let items: UserDocument[];
    if (queryOptions.sortBy.type === 'desc')
      items = await pages.sort(`-${queryOptions.sortBy.field}`).exec();
    else items = await pages.sort(`${queryOptions.sortBy.field}`).exec();
    return { items, pagination };
  };

  /**
   *
   * @param credential
   * @param user
   * @returns
   */
  isCredentialFollow = async (
    credential: CredentialDocument,
    user: UserDocument
  ) => {
    const credentialUser = await this.getUserFromCredential(credential);
    const relationship = await this._relationshipModel
      .findOne({
        user: credentialUser._id,
        followedUser: user._id,
        visibility: EntityVisibility.Publish,
        blocking: false,
        following: true
      })
      .exec();
    return Boolean(relationship);
  };

  /**
   *
   * @param {UserDocument} user
   * @param {UserDocument} followedUser
   * @returns {Promise<void>}
   */
  follow = async (user: UserDocument, followedUser: UserDocument) => {
    this.userProducer.sendMessage({
      id: user._id,
      action: CastcleQueueAction.CreateFollowFeedItem,
      options: {
        followedId: followedUser._id
      }
    });
    return user.follow(followedUser);
  };

  /**
   *
   * @param {UserDocument} user
   * @param {UserDocument} followedUser
   * @returns {Promise<void>}
   */
  unfollow = async (user: UserDocument, followedUser: UserDocument) =>
    user.unfollow(followedUser);

  /**
   *
   * @param user
   * @param queryOption
   * @returns
   */
  getFollower = async (
    user: UserDocument,
    queryOption: CastcleQueryOptions = DEFAULT_QUERY_OPTIONS
  ) => {
    const filter: FilterQuery<RelationshipDocument> = {
      followedUser: user._id,
      visibility: EntityVisibility.Publish,
      blocking: false,
      following: true
    };

    if (queryOption.type)
      filter.isFollowPage = queryOption.type === UserType.Page;
    let query = this._relationshipModel
      .find(filter)
      .skip(queryOption.page - 1)
      .limit(queryOption.limit)
      .populate('user');
    if (queryOption.sortBy.type === 'desc')
      query = query.sort(`-${queryOption.sortBy.field}`);
    else query = query.sort(`${queryOption.sortBy.field}`);
    const totalFollower = await this._relationshipModel.count(filter).exec();
    const relationships = await query.exec();
    console.log('total', totalFollower);
    console.log(relationships);
    return {
      items: relationships.map((r) =>
        this._userModel.covertToUserResponse(r.user)
      ),
      pagination: createPagination(queryOption, totalFollower)
    };
  };

  /**
   *
   * @param user
   * @param queryOption
   * @returns
   */
  getFollowing = async (
    user: UserDocument,
    queryOption: CastcleQueryOptions = DEFAULT_QUERY_OPTIONS
  ) => {
    const filter: FilterQuery<RelationshipDocument> = {
      user: user._id,
      visibility: EntityVisibility.Publish,
      blocking: false,
      following: true
    };

    if (queryOption.type)
      filter.isFollowPage = queryOption.type === UserType.Page;
    let query = this._relationshipModel
      .find(filter)
      .populate('followedUser')
      .skip(queryOption.page - 1)
      .limit(queryOption.limit);
    //      .populate('followedUser');
    if (queryOption.sortBy.type === 'desc')
      query = query.sort(`-${queryOption.sortBy.field}`);
    else query = query.sort(`${queryOption.sortBy.field}`);
    const totalFollowing = await this._relationshipModel.count(filter).exec();
    const relationships = await query.exec();
    return {
      items: relationships.map((r) =>
        this._userModel.covertToUserResponse(r.followedUser)
      ),
      pagination: createPagination(queryOption, totalFollowing)
    };
  };

  /**
   * TODO !!! need to find a way to put in transaction
   * Deactivate User account
   * @param {UserDocument} user
   * @returns {UserDocument}
   */
  deactive = async (user: UserDocument) => {
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
          queueAction: CastcleQueueAction.Deleting
        }
      );
      this.userProducer.sendMessage({
        id: user.ownerAccount,
        action: CastcleQueueAction.Deleting
      } as UserMessage);
    }
    return userResult;
  };

  /**
   * get all user account this this account is owned;
   * @param {AccountDocument} account
   * @returns {UserDocument[]}
   */
  _getAllUserFromAccount = (account: AccountDocument) =>
    this._userModel.find({ ownerAccount: account._id }).exec();

  /**
   * flag all contents that this user has create to deleted // this will update the engagement recast/quotecast to -1 if it was recast or quotecast
   * @param {UserDocument} user
   * @returns {ContentDocument[]}
   */
  _removeAllContentFromUser = async (user: UserDocument) => {
    const contents = await this.contentService._contentModel
      .find({ 'author.id': user._id })
      .exec();
    const promiseRemoveContents: Promise<ContentDocument>[] = contents.map(
      (contentItem) => this.contentService.deleteContentFromId(contentItem._id)
    );
    return Promise.all(promiseRemoveContents);
  };

  _removeAllCommentFromUser = async (user: UserDocument) => {
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
   * update engagements flag of this user to hidden this should invoke enagement.post('save') to update like counter
   * @param {UserDocument} user
   * @returns {EngagementDocument[]}
   */
  _removeAllEngagements = async (user: UserDocument) => {
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
  _removeAllFollower = async (user: UserDocument) => {
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
  _deactiveAccount = async (account: AccountDocument) => {
    const deactiveUsersResult = await Promise.all(
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
          visibility: EntityVisibility.Deleted
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

  reactive = async (user: UserDocument) => {
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
    const promiseReactiveContents: Promise<ContentDocument>[] = contents.map(
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
          visibility: EntityVisibility.Publish
        }
      );
    return user.save();
  };

  /**
   * Get all user,pages that could get from the system sort by followerCount
   * @param {string} query
   * @param {CastcleQueryOptions} queryOption
   * @returns {Promise<{users:UserDocument[], pagination:Pagination}>}
   */
  getMentionsFromPublic = async (
    query: string,
    queryOption: CastcleQueryOptions
  ) => {
    const filter = {
      displayId: { $regex: new RegExp('^' + query.toLowerCase(), 'i') }
    };
    const users = await this._userModel
      .find(filter)
      .skip(queryOption.page - 1)
      .limit(queryOption.limit)
      .sort('-followerCount')
      .exec();
    const pagination = createPagination(
      queryOption,
      await this._userModel.countDocuments(filter)
    );
    return {
      users: users,
      pagination: pagination
    };
  };

  async blockUser(user: UserDocument, blockedUser?: UserDocument) {
    if (!blockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const relationship = {
      user: user._id,
      followedUser: blockedUser._id,
      visibility: EntityVisibility.Publish,
      following: false
    };

    await this._relationshipModel
      .updateOne(
        { user: user._id, followedUser: blockedUser._id },
        { $setOnInsert: relationship, $set: { blocking: true } },
        { upsert: true }
      )
      .exec();
  }

  async unblockUser(user: UserDocument, unblockedUser: UserDocument) {
    if (!unblockedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const relationship = await this._relationshipModel
      .findOne({
        user: user._id,
        followedUser: unblockedUser._id,
        blocking: true
      })
      .exec();

    if (!relationship) return;

    relationship.blocking = false;
    await relationship.save();
  }

  async reportUser(
    user: UserDocument,
    reportedUser: UserDocument,
    message: string
  ) {
    if (!reportedUser) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const mail = await this.transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: `Report user: ${reportedUser._id}`,
      to: Environment.SMTP_ADMIN_EMAIL,
      text: `User ${reportedUser.displayName} (${reportedUser._id}) has been reported.
Reported by: ${user.displayName} (${user._id})
Message: ${message}`
    });

    this.logger.log(`Report has been submitted ${mail.messageId}`);
  }

  updateMobile = async (
    userId: string,
    accountId: string,
    countryCode: string,
    mobileNumber: string
  ) => {
    await this._accountModel
      .updateOne(
        { _id: accountId },
        {
          'mobile.countryCode': countryCode,
          'mobile.number': mobileNumber
        }
      )
      .exec();
    this.logger.log('Success update mobile to account');

    const user = this._userModel
      .updateOne(
        { _id: userId },
        {
          'verified.mobile': true
        }
      )
      .exec();
    this.logger.log('Success update verify mobile to user');
    return user;
  };
}
