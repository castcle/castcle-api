import { Campaign, User } from '@castcle-api/database';
import { Types } from 'mongoose';

export class ClaimAirdropCommand {
  constructor(
    public readonly campaign: Campaign | Types.ObjectId,
    public readonly user?: User | Types.ObjectId,
  ) {}
}
