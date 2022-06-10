import { Configs } from '@castcle-api/environments';
import { FacebookClient } from '@castcle-api/utils/clients';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/users/src/app/app.module';
import { apps } from '../variables';

export const setupUsersModule = async () => {
  const facebookClient = {
    subscribeApps: () => {
      return true;
    },
    unsubscribeApps: () => {
      return true;
    },
    subscribed: () => {
      return true;
    },
    unsubscribed: () => {
      return true;
    },
  };
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(FacebookClient)
    .useValue(facebookClient)
    .compile();

  apps.users = moduleFixture.createNestApplication();
  apps.users.useGlobalPipes(new ValidationPipe());
  apps.users.useGlobalFilters(new CastcleExceptionFilter());
  apps.users.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await apps.users.init();
};

export const closeUsersModule = () => {
  return apps.users.close();
};
