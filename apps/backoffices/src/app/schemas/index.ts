import { Environment } from '@castcle-api/environments';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffSchema } from './staff.schema';

export const BackOfficeMongooseForFeatures = MongooseModule.forFeature(
  [{ name: 'Staff', schema: StaffSchema }],
  Environment.BACKOFFICE_DB_DATABASE_NAME,
);
