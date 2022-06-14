import { Configs, Environment } from '@castcle-api/environments';
import { Image } from '@castcle-api/utils/aws';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, SchemaTypes } from 'mongoose';
import {
  Author,
  CastcleImage,
  EntityVisibility,
  PageResponseDto,
  SearchFollowsResponseDto,
  UserContact,
  UserResponseDto,
} from '../dtos';
import {
  AccountAuthentications,
  AuthenticationProvider,
  UserType,
  UserVerified,
} from '../models';
import { Account, AccountAuthenId, SocialSync } from '../schemas';
import { CastcleBase } from './base.schema';
import { Relationship } from './relationship.schema';

type ProfileImage = {
  avatar?: CastcleImage;
  cover?: CastcleImage;
};

export interface UserProfile {
  birthdate?: Date | null;
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

@Schema({ timestamps: true })
class UserDocument extends CastcleBase {
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
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

  @Prop({ type: String, required: true })
  type: UserType;

  @Prop({ type: Object })
  verified: UserVerified;

  @Prop({ default: 0 })
  followerCount: number;

  @Prop({ default: 0 })
  followedCount: number;

  @Prop()
  displayIdUpdatedAt?: Date;

  @Prop({ type: Object })
  contact?: UserContact;
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

type UserResponseOptionV2 = {
  passwordNotSet?: boolean;
  blocked?: boolean;
  blocking?: boolean;
  followed?: boolean;
  balance?: number;
  mobile?: { countryCode: string; number: string };
  authentications?: AccountAuthentications;
  syncSocials?: SocialSync[];
  casts?: number;
  pdpa?: boolean;
};

export class User extends UserDocument {
  canUpdateCastcleId: () => boolean;
  follow: (user: User) => Promise<void>;
  unfollow: (user: User) => Promise<void>;
  toSearchTopTrendResponse: () => SearchFollowsResponseDto;
  toAuthor: (user?: User | User) => Author;
  toUserResponse: (option?: UserResponseOption) => Promise<UserResponseDto>;
  toUserResponseV2: (option?: UserResponseOptionV2) => Promise<UserResponseDto>;
  toPageResponse: (
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean,
    syncSocial?: SocialSync,
    casts?: number,
  ) => PageResponseDto;
  toPageResponseV2: (
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean,
    syncSocials?: SocialSync[],
    casts?: number,
  ) => PageResponseDto;
}

export const UserSchema = SchemaFactory.createForClass<UserDocument, User>(
  UserDocument,
);

const _covertToUserResponse = (self: User | User, followed?: boolean) => {
  const selfSocial: any = { ...self.profile?.socials };
  if (self.profile?.websites?.length > 0)
    selfSocial.website = self.profile.websites[0].website;
  return {
    id: self._id,
    castcleId: self.displayId,
    displayName: self.displayName,
    type: self.type,
    dob: self.profile?.birthdate || null,
    followers: { count: self.followerCount },
    following: { count: self.followedCount },
    images: {
      avatar: self.profile?.images?.avatar
        ? new Image(self.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      cover: self.profile?.images?.cover
        ? new Image(self.profile.images.cover).toSignUrls()
        : Configs.DefaultAvatarCovers,
    },
    overview: self.profile?.overview || null,
    links: selfSocial,
    verified: self.verified,
    followed: followed,
    canUpdateCastcleId: self.canUpdateCastcleId(),
    contact: self.contact,
  } as UserResponseDto;
};

UserSchema.methods.toUserResponse = async function ({
  passwordNotSet,
  blocked,
  blocking,
  followed,
  balance,
  mobile,
  linkSocial,
  syncSocial,
  casts,
}: UserResponseOption = {}) {
  const self = await this.populate('ownerAccount').execPopulate();
  const response = _covertToUserResponse(self as User, followed);
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
      ...linkSocial.map((social) => {
        return {
          [social.type]: {
            socialId: social.socialId,
            displayName: social.displayName,
          },
        };
      }),
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

UserSchema.methods.toUserResponseV2 = async function ({
  passwordNotSet,
  blocked,
  blocking,
  followed,
  balance,
  mobile,
  authentications,
  syncSocials,
  casts,
  pdpa,
}: UserResponseOptionV2 = {}) {
  const self = await this.populate('ownerAccount').execPopulate();
  const response = _covertToUserResponse(self as User, followed);
  response.email = self.ownerAccount?.email ?? null;
  response.blocking = blocking;
  response.blocked = blocked;
  response.passwordNotSet = passwordNotSet;
  response.wallet = { balance };
  response.mobile = mobile;
  response.linkSocial = {};
  response.pdpa = pdpa;

  Object.values(AuthenticationProvider).forEach((provider) => {
    response.linkSocial[provider] = authentications?.[provider]
      ? { socialId: authentications[provider].socialId }
      : null;
  });

  response.syncSocial =
    syncSocials?.length > 0
      ? Object.assign(
          {},
          ...syncSocials.map((item) => ({
            [item.provider]: {
              id: item._id,
              provider: item.provider,
              socialId: item.socialId,
              userName: item.userName,
              displayName: item.displayName,
              avatar: item.avatar,
              active: item.active,
              autoPost: item.autoPost,
            },
          })),
        )
      : undefined;

  response.casts = casts;
  return response;
};

UserSchema.methods.toPageResponse = function (
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean,
  syncSocial?: SocialSync,
  casts?: number,
) {
  return {
    id: this._id,
    castcleId: this.displayId,
    displayName: this.displayName,
    type: this.type,
    images: {
      avatar: this.profile?.images?.avatar
        ? new Image(this.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      cover: this.profile?.images?.cover
        ? new Image(this.profile.images.cover).toSignUrls()
        : Configs.DefaultAvatarCovers,
    },
    followers: { count: this.followerCount },
    following: { count: this.followedCount },
    overview: this.profile?.overview || null,
    links: {
      facebook: this.profile?.socials?.facebook || null,
      medium: this.profile?.socials?.medium || null,
      twitter: this.profile?.socials?.twitter || null,
      youtube: this.profile?.socials?.youtube || null,
      website: this.profile?.websites?.[0]?.website || null,
    },
    verified: { official: this.verified.official },
    blocked,
    blocking,
    followed,
    updatedAt: this.updatedAt.toISOString(),
    createdAt: this.createdAt.toISOString(),
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
    canUpdateCastcleId: this.canUpdateCastcleId(),
  } as PageResponseDto;
};

UserSchema.methods.toPageResponseV2 = function (
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean,
  syncSocials?: SocialSync[],
  casts?: number,
) {
  return {
    id: this._id,
    castcleId: this.displayId,
    displayName: this.displayName,
    type: this.type,
    images: {
      avatar: this.profile?.images?.avatar
        ? new Image(this.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      cover: this.profile?.images?.cover
        ? new Image(this.profile.images.cover).toSignUrls()
        : Configs.DefaultAvatarCovers,
    },
    followers: { count: this.followerCount },
    following: { count: this.followedCount },
    overview: this.profile?.overview || null,
    links: {
      facebook: this.profile?.socials?.facebook || null,
      medium: this.profile?.socials?.medium || null,
      twitter: this.profile?.socials?.twitter || null,
      youtube: this.profile?.socials?.youtube || null,
      website: this.profile?.websites?.[0]?.website || null,
    },
    verified: { official: this.verified.official },
    blocked,
    blocking,
    followed,
    updatedAt: this.updatedAt.toISOString(),
    createdAt: this.createdAt.toISOString(),
    syncSocial:
      syncSocials?.length > 0
        ? Object.assign(
            {},
            ...syncSocials.map((item) => ({
              [item.provider]: {
                id: item._id,
                provider: item.provider,
                socialId: item.socialId,
                userName: item.userName,
                displayName: item.displayName,
                avatar: item.avatar,
                active: item.active,
                autoPost: item.autoPost,
              },
            })),
          )
        : undefined,
    casts: casts,
    canUpdateCastcleId: this.canUpdateCastcleId(),
    contact: this.contact,
  } as PageResponseDto;
};

UserSchema.methods.toSearchTopTrendResponse = function () {
  return {
    id: this._id,
    castcleId: this.displayId,
    displayName: this.displayName,
    overview: this.profile?.overview || '',
    avatar: this.profile?.images?.avatar
      ? new Image(this.profile.images.avatar).toSignUrls()
      : Configs.DefaultAvatarImages,
    type: this.type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
    },
    verified:
      this.verified?.email || this.verified?.mobile || this.verified?.official,
    count: this.followerCount,
  } as SearchFollowsResponseDto;
};

UserSchema.methods.canUpdateCastcleId = function (): boolean {
  if (!this.displayIdUpdatedAt) return true;

  const now = DateTime.local();
  const canUpdateCastcleIdAt = DateTime.fromJSDate(
    this.displayIdUpdatedAt,
  ).plus({ days: Environment.CASTCLE_ID_ALLOW_UPDATE_DAYS });

  return canUpdateCastcleIdAt <= now;
};

export const UserSchemaFactory = (relationshipModel: Model<Relationship>) => {
  UserSchema.pre('save', function (next) {
    if (!this.visibility) this.visibility = EntityVisibility.Publish;
    if (!this.followedCount) this.followedCount = 0;
    if (!this.followerCount) this.followerCount = 0;
    if (!this.verified)
      this.verified = {
        email: false,
        mobile: false,
        official: false,
        social: false,
      };
    next();
  });

  UserSchema.methods.toAuthor = function () {
    return {
      id: this._id,
      avatar: this.profile?.images?.avatar
        ? new Image(this.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
      castcleId: this.displayId,
      displayName: this.displayName,
      type: this.type,
      verified: this.verified,
    } as Author;
  };

  UserSchema.methods.follow = async function (followedUser: User) {
    const session = await relationshipModel.startSession();
    await session.withTransaction(async () => {
      ///TODO !!! Might have to change if relationship is embed
      const setObject = {
        user: this._id,
        followedUser: followedUser._id,
        isFollowPage: false,
        blocking: false,
        visibility: EntityVisibility.Publish,
      };
      if ((followedUser as User).type === UserType.PAGE)
        setObject.isFollowPage = true;
      const result = await relationshipModel
        .updateOne(
          {
            user: this._id,
            followedUser: followedUser._id,
          },
          {
            $setOnInsert: setObject,
            $set: { following: true },
          },
          {
            upsert: true,
          },
        )
        .exec();
      if (result.upserted) {
        this.followedCount++;
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
          user: this._id,
          followedUser: followedUser._id,
          following: true,
        })
        .exec();

      if (!relationship) return;

      this.followedCount--;
      followedUser.followerCount--;

      const toSaves: Promise<any>[] = [this.save(), followedUser.save()];

      if (relationship.blocking || relationship.blocked) {
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
