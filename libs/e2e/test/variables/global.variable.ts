import { CampaignSchema, UserSchema } from '@castcle-api/database/schemas';
import { model } from 'mongoose';
import { User } from '../models';

export const campaignModel = model('Campaign', CampaignSchema);
export const userModel = model('User', UserSchema);

/** verified: `mobile` */
export const userAlpha = new User('alpha');

/** verified: `none` */
export const userBeta = new User('beta');
