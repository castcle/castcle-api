import {
  AdsCampaignSchema,
  CampaignSchema,
  ContentSchema,
  ReportingSchema,
  UserSchema,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffSchema } from './staff.schema';

export const BackOfficeMongooseForFeatures = MongooseModule.forFeature(
  [{ name: 'Staff', schema: StaffSchema }],
  Environment.BACKOFFICE_DB_DATABASE_NAME,
);

export const CastcleDatabaseReadonly = MongooseModule.forFeature(
  [
    { name: 'AdsCampaign', schema: AdsCampaignSchema },
    { name: 'Content', schema: ContentSchema },
    { name: 'Campaign', schema: CampaignSchema },
    { name: 'User', schema: UserSchema },
    { name: 'Reporting', schema: ReportingSchema },
  ],
  Environment.DB_DATABASE_NAME,
);
