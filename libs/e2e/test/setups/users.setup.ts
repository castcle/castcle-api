import { Configs } from '@castcle-api/environments';
import { FacebookClient } from '@castcle-api/utils/clients';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/users/src/app/app.module';
import { usersApp } from '../variables';

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

  (usersApp as any) = moduleFixture.createNestApplication();

  usersApp.useGlobalPipes(new ValidationPipe());
  usersApp.useGlobalFilters(new CastcleExceptionFilter());
  usersApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await usersApp.init();
};

export const closeUsersModule = () => {
  return usersApp.close();
};
