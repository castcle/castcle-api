import { Configs, Environment } from '@castcle-api/environments';
import { Image } from '@castcle-api/utils/aws';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { SearchFollowsResponseDto } from '../dtos';
import { CastcleImage, EntityVisibility } from '../dtos/common.dto';
import { Author } from '../dtos/content.dto';
import { PageResponseDto, UserResponseDto } from '../dtos/user.dto';
import { PageVerified, UserVerified } from '../models';
import { Account, AccountAuthenId, SocialSync } from '../schemas';
import { CastcleBase } from './base.schema';
import { Relationship } from './relationship.schema';

type ProfileImage = {
  avatar?: CastcleImage;
  cover?: CastcleImage;
};

export interface UserProfile {
  birthdate?: string;
  overview?: string;
  works?: string[];
  educations?: string[];
  homeTowns?: string[];
  websites?: {
    website: string;
    detail: string;
  }[];
  socials?: {
    facebook?: string;
    twitter?: string;
    youtube?: string;
    medium?: string;
  };
  details?: string;
  images?: ProfileImage;
}

export enum UserType {
  People = 'people',
  Page = 'page',
  Topic = 'topic',
}

@Schema({ timestamps: true })
class UserDocument extends CastcleBase {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
  })
  ownerAccount: Account;

  /**
   * This is the same as castcleId
   * @field this is field displayName
   */
  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true, index: true })
  displayId: string;

  @Prop({ type: Object })
  profile?: UserProfile;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  verified: UserVerified;

  @Prop()
  followerCount: number;

  @Prop()
  followedCount: number;

  @Prop()
  displayIdUpdatedAt?: Date;
}

type UserResponseOption = {
  passwordNotSet?: boolean;
  blocked?: boolean;
  blocking?: boolean;
  followed?: boolean;
  balance?: number;
  mobile?: { countryCode: string; number: string };
  linkSocial?: AccountAuthenId[];
  syncSocial?: SocialSync[];
  casts?: number;
};

export const UserSchema = SchemaFactory.createForClass(UserDocument);

export class User extends UserDocument {
  covertToUserResponse: (
    user: User | User,
    followed?: boolean
  ) => UserResponseDto;
  follow: (user: User) => Promise<void>;
  unfollow: (user: User) => Promise<void>;
  toSearchTopTrendResponse: () => SearchFollowsResponseDto;
  toSearchResponse: () => SearchFollowsResponseDto;
  toAuthor: (user?: User | User) => Author;
  toUserResponse: (option?: UserResponseOption) => Promise<UserResponseDto>;
  toPageResponse: (
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean,
    syncSocial?: SocialSync,
    casts?: number
  ) => PageResponseDto;
}

const _covertToUserResponse = (self: User | User, followed?: boolean) => {
  const selfSocial: any =
    self.profile && self.profile.socials ? { ...self.profile.socials } : {};
  if (self.profile && self.profile.websites && self.profile.websites.length > 0)
    selfSocial.website = self.profile.websites[0].website;
  return {
    id: self._id,
    castcleId: self.displayId,
    displayName: self.displayName,
    type: self.type,
    dob: self.profile && self.profile.birthdate ? self.profile.birthdate : null,
    followers: {
      count: self.followerCount,
    },
    following: {
      count: self.followedCount,
    },
    images: {
      avatar:
        self.profile && self.profile.images && self.profile.images.avatar
          ? new Image(self.profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      cover:
        self.profile && self.profile.images && self.profile.images.cover
          ? new Image(self.profile.images.cover).toSignUrls()
          : Configs.DefaultAvatarCovers,
    },
    overview:
      self.profile && self.profile.overview ? self.profile.overview : null,
    links: selfSocial,
    verified: self.verified, //self.verified ? true : false,
    followed: followed,
    canUpdateCastcleId: self.displayIdUpdatedAt
      ? _verifyUpdateCastcleId(self.displayIdUpdatedAt)
      : true,
  } as UserResponseDto;
};

UserSchema.statics.covertToUserResponse = (
  self: User | User,
  followed = false
) => _covertToUserResponse(self, followed);

UserSchema.statics.toAuthor = (self: User | User) =>
  ({
    id: self._id,
    avatar:
      self.profile && self.profile.images && self.profile.images.avatar
        ? new Image(self.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    castcleId: self.displayId,
    displayName: self.displayName,
    type: self.type,
    verified: self.verified,
  } as Author);

UserSchema.methods.toUserResponse = async function (
  {
    passwordNotSet = false,
    blocked,
    blocking,
    followed,
    balance,
    mobile,
    linkSocial,
    syncSocial,
    casts,
  } = {} as UserResponseOption
) {
  const self = await (this as User).populate('ownerAccount').execPopulate();
  const response = _covertToUserResponse(self, followed);
  response.email = self.ownerAccount?.email ?? null;
  response.blocking = blocking;
  response.blocked = blocked;
  response.passwordNotSet = passwordNotSet;
  response.wallet = {
    balance: balance,
  };
  response.mobile = mobile;
  if (linkSocial) {
    response.linkSocial = Object.assign(
      {},
      ...linkSocial.map((social: AccountAuthenId) => {
        return {
          [social.type]: {
            socialId: social.socialId,
            displayName: social.displayName,
          },
        };
      })
    );

    response.linkSocial.facebook = response.linkSocial.facebook ?? null;
    response.linkSocial.twitter = response.linkSocial.twitter ?? null;
    response.linkSocial.google = response.linkSocial.google ?? null;
    response.linkSocial.apple = response.linkSocial.apple ?? null;
  }

  response.syncSocial = syncSocial?.map((social) => {
    return {
      id: social.id,
      provider: social.provider,
      socialId: social.socialId,
      userName: social.userName,
      displayName: social.displayName,
      avatar: social.avatar,
      active: social.active,
      autoPost: social.autoPost,
    };
  });
  response.casts = casts;
  return response;
};

UserSchema.methods.toPageResponse = function (
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean,
  syncSocial?: SocialSync,
  casts?: number
) {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    type: (this as User).type,
    images: {
      avatar:
        (this as User).profile &&
        (this as User).profile.images &&
        (this as User).profile.images.avatar
          ? new Image((this as User).profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      cover:
        (this as User).profile &&
        (this as User).profile.images &&
        (this as User).profile.images.cover
          ? new Image((this as User).profile.images.cover).toSignUrls()
          : Configs.DefaultAvatarCovers,
    },
    followers: {
      count: (this as User).followerCount,
    },
    following: {
      count: (this as User).followedCount,
    },
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : null,
    links: {
      facebook:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.facebook
          ? (this as User).profile.socials.facebook
          : null,
      medium:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.medium
          ? (this as User).profile.socials.medium
          : null,
      twitter:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.twitter
          ? (this as User).profile.socials.twitter
          : null,
      youtube:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.youtube
          ? (this as User).profile.socials.youtube
          : null,
      website:
        (this as User).profile && (this as User).profile.websites
          ? (this as User).profile.websites[0].website
          : null,
    },
    verified: {
      official: (this as User).verified.official,
    } as PageVerified,
    blocked,
    blocking,
    followed,
    updatedAt: (this as User).updatedAt.toISOString(),
    createdAt: (this as User).createdAt.toISOString(),
    syncSocial: syncSocial
      ? {
          id: syncSocial.id,
          provider: syncSocial.provider,
          socialId: syncSocial.socialId,
          userName: syncSocial.userName,
          displayName: syncSocial.displayName,
          avatar: syncSocial.avatar,
          active: syncSocial.active,
          autoPost: syncSocial.autoPost,
        }
      : undefined,
    casts: casts,
    canUpdateCastcleId: (this as User).displayIdUpdatedAt
      ? _verifyUpdateCastcleId((this as User).displayIdUpdatedAt)
      : true,
  } as PageResponseDto;
};

UserSchema.methods.toSearchTopTrendResponse = function () {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : '',
    avatar:
      (this as User).profile &&
      (this as User).profile.images &&
      (this as User).profile.images.avatar
        ? new Image((this as User).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as User).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
    },
    verified:
      (this as User).verified &&
      ((this as User).verified.email ||
        (this as User).verified.mobile ||
        (this as User).verified.official),
    count: (this as User).followerCount,
  } as SearchFollowsResponseDto;
};

UserSchema.methods.toSearchResponse = function () {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : '',
    avatar:
      (this as User).profile &&
      (this as User).profile.images &&
      (this as User).profile.images.avatar
        ? new Image((this as User).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as User).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
      count: 1234,
    },
    verified:
      (this as User).verified &&
      ((this as User).verified.email ||
        (this as User).verified.mobile ||
        (this as User).verified.official),
    // TODO !!! need implement followed
    followed: true,
  } as SearchFollowsResponseDto;
};

const _verifyUpdateCastcleId = (displayIdUpdateAt: Date) => {
  displayIdUpdateAt.setDate(
    displayIdUpdateAt.getDate() + Environment.CASTCLE_ID_ALLOW_UPDATE_DAYS
  );
  const now = new Date().getTime();
  const allowUpdate = displayIdUpdateAt.getTime();
  return allowUpdate - now >= 0;
};
export const UserSchemaFactory = (
  relationshipModel: Model<Relationship>
  /*contentModel: Model<Content>,
  feedModel: Model<FeedItem>,
  commentModel: Model<Comment>*/
): mongoose.Schema<any> => {
  /**
   * Make sure all aggregate counter is 0
   */
  UserSchema.pre('save', function (next) {
    if (!(this as User).visibility)
      (this as User).visibility = EntityVisibility.Publish;
    if (!(this as User).followedCount) (this as User).followedCount = 0;
    if (!(this as User).followerCount) (this as User).followerCount = 0;
    //add activate state
    if (!(this as User).verified)
      (this as User).verified = {
        email: false,
        mobile: false,
        official: false,
        social: false,
      } as UserVerified;
    next();
  });

  UserSchema.methods.toAuthor = function () {
    const self = this as User;
    return {
      id: self._id,
      avatar:
        self.profile && self.profile.images && self.profile.images.avatar
          ? new Image(self.profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      castcleId: self.displayId,
      displayName: self.displayName,
      type: self.type,
      verified: self.verified,
    } as Author;
  };

  UserSchema.methods.follow = async function (followedUser: User) {
    const session = await relationshipModel.startSession();
    await session.withTransaction(async () => {
      ///TODO !!! Might have to change if relationship is embed
      const setObject = {
        user: (this as User)._id,
        followedUser: followedUser._id,
        isFollowPage: false,
        blocking: false,
        visibility: EntityVisibility.Publish,
      };
      if ((followedUser as User).type === UserType.Page)
        setObject.isFollowPage = true;
      const result = await relationshipModel
        .updateOne(
          {
            user: (this as User)._id,
            followedUser: followedUser._id,
          },
          {
            $setOnInsert: setObject,
            $set: { following: true },
          },
          {
            upsert: true,
          }
        )
        .exec();
      if (result.upserted) {
        (this as User).followedCount++;
        followedUser.followerCount++;
        await Promise.all([this.save(), followedUser.save()]);
      }
    });
    session.endSession();
  };

  UserSchema.methods.unfollow = async function (followedUser: User) {
    const session = await relationshipModel.startSession();

    await session.withTransaction(async () => {
      const relationship = await relationshipModel
        .findOne({
          user: (this as User)._id,
          followedUser: followedUser._id,
          following: true,
        })
        .exec();

      if (!relationship) return;

      (this as User).followedCount--;
      followedUser.followerCount--;

      const toSaves: Promise<any>[] = [this.save(), followedUser.save()];

      if (relationship.blocking) {
        relationship.following = false;
        toSaves.push(relationship.save());
      } else {
        toSaves.push(relationship.delete());
      }

      await Promise.all(toSaves);
    });

    session.endSession();
  };

  return UserSchema;
};
