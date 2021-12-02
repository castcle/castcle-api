import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntityVisibility, SocialSyncDto } from '../dtos';
import {
  SocialProvider,
  SocialSync,
  SocialSyncDocument,
  UserDocument,
  UserType
} from '../schemas';
import { Author } from '../schemas/author.schema';

@Injectable()
export class SocialSyncService {
  private readonly logger = new CastLogger(
    SocialSyncService.name,
    CastLoggerOptions
  );
  constructor(
    @InjectModel('SocialSync') private socialSyncModel: Model<SocialSync>
  ) {}

  /**
   * get auto-sync accounts by social provider
   * @param {SocialProvider} socialProvider
   * @returns {Promise<SocialSyncDocument[]>}
   */
  getAutoSyncAccounts = (
    socialProvider: SocialProvider
  ): Promise<SocialSyncDocument[]> => {
    return this.socialSyncModel
      .find({ active: true, provider: socialProvider })
      .exec();
  };

  /**
   * get auto-sync account by social ID
   * @param {SocialProvider} socialProvider e.g. facebook, google, twitter
   * @param {string} socialId
   * @returns {Promise<SocialSyncDocument>}
   */
  getAutoSyncAccountBySocialId = (
    socialProvider: SocialProvider,
    socialId: string
  ): Promise<SocialSyncDocument> => {
    return this.socialSyncModel
      .findOne({ active: true, provider: socialProvider, socialId })
      .exec();
  };

  /**
   * create new language
   * @param {UserDocument} user
   * @param {SocialSyncDto} socialSync payload
   * @returns {SocialSyncDocument} return new social sync document
   * */
  async create(user: UserDocument, socialSync: SocialSyncDto) {
    this.logger.log('save social sync.');
    const author: Author = {
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      followed: false,
      type: user.type === UserType.Page ? UserType.Page : UserType.People,
      verified: user.verified
    };

    const newSocialSync = new this.socialSyncModel({
      author: author,
      provider: socialSync.provider,
      socialId: socialSync.uid,
      userName: socialSync.userName,
      displayName: socialSync.displayName,
      avatar: socialSync.avatar,
      active: socialSync.active ? socialSync.active : true
    });
    return newSocialSync.save();
  }

  /**
   * get social sync from User Document
   *
   * @param {UserDocument} user
   * @returns {SocialSyncDocument[]} return all social sync Document
   * */
  async getsocialSyncFromUser(user: UserDocument) {
    const findFilter: {
      'author.id': any;
      visibility: EntityVisibility;
    } = {
      'author.id': user._id,
      visibility: EntityVisibility.Publish
    };
    return this.socialSyncModel.find(findFilter).exec();
  }
}
