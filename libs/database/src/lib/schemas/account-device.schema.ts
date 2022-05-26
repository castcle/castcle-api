import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { AcceptPlatform } from '../dtos/common.dto';
import { CastcleBase } from './base.schema';

@Schema({ timestamps: true })
export class AccountDeviceV1 extends CastcleBase {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Types.ObjectId;

  @Prop({ required: true })
  firebaseToken: string;

  @Prop({ required: true, index: true })
  uuid: string;

  @Prop({ type: AcceptPlatform, required: true, index: true })
  platform: string;
}

export const AccountDeviceSchema =
  SchemaFactory.createForClass(AccountDeviceV1);

AccountDeviceSchema.index(
  { account: 1, uuid: 1, platform: 1 },
  { unique: true },
);
