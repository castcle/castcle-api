import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserVerified } from '../models';
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

  @Prop({ type: Object })
  avatar: CastcleImage | null;

  @Prop({ type: Object })
  verified: UserVerified;
}

export const AuthorSchema = SchemaFactory.createForClass(Author);
