import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserVerified } from './user.schema';
import { CastcleImage } from '../dtos';

@Schema({ _id: false, timestamps: false, versionKey: false })
export class Author {
  @Prop({ index: true })
  id: string;

  @Prop()
  type: 'people' | 'page';

  @Prop({ index: true })
  castcleId: string;

  @Prop()
  displayName: string;

  @Prop()
  avatar: CastcleImage | null;

  @Prop({ type: Object })
  verified: UserVerified;

  @Prop()
  followed: boolean;
}

export const AuthorSchema = SchemaFactory.createForClass(Author);
