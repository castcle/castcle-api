import {
  AccountActivationSchema,
  AccountDeviceSchema,
  CampaignSchema,
  CredentialSchema,
  OtpSchema,
  RelationshipSchema,
  SocialSyncSchema,
  User as UserDocument,
  UserSchema,
} from '@castcle-api/database';
import { model } from 'mongoose';
import { CommentSchema } from '../../../database/src/lib/schemas/comment.schema';
import { ContentSchema } from '../../../database/src/lib/schemas/content.schema';
import { User } from '../models';

export const campaignModel = model('Campaign', CampaignSchema);
export const otpModel = model('Otp', OtpSchema);
export const userModel = model<UserDocument>('User', UserSchema);
export const accountActivationModel = model(
  'AccountActivation',
  AccountActivationSchema,
);
export const credentialModel = model('Credential', CredentialSchema);
export const accountDeviceModel = model('AccountDevice', AccountDeviceSchema);
export const socialSyncModel = model('SocialSync', SocialSyncSchema);
export const relationshipModel = model('Relationship', RelationshipSchema);
export const contentModel = model('Content', ContentSchema);
export const commentModel = model('Comment', CommentSchema);
/** verified: `mobile` */
export const userAlpha = new User({ name: 'alpha' });

/** verified: `none` */
export const userBeta = new User({ name: 'beta' });
export const userGamma = new User({ name: 'gamma' });

/** account.isGuest: true */
export const guest = new User({ name: 'guest' });
