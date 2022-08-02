import { Environment } from '@castcle-api/environments';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffRoleSchema } from './staff-role.schema';
import { StaffSchema } from './staff.schema';

export const BackOfficeMongooseForFeatures = MongooseModule.forFeature(
  [
    { name: 'Staff', schema: StaffSchema },
    {
      name: 'StaffRoles',
      schema: StaffRoleSchema,
    },
  ],
  Environment.BACKOFFICE_DB_DATABASE_NAME,
);
