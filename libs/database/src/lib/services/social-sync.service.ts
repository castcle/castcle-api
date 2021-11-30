import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocialProvider, SocialSync, SocialSyncDocument } from '../schemas';

@Injectable()
export class SocialSyncService {
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
}
