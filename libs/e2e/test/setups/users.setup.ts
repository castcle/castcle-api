import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserModule } from '../../../../apps/users/src/app/app.module';
import { usersApp } from '../variables';

export const setupUsersModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [UserModule],
  }).compile();

  (usersApp as any) = moduleFixture.createNestApplication();

  usersApp.useGlobalPipes(new ValidationPipe());
  usersApp.useGlobalFilters(new ExceptionFilter());
  usersApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await usersApp.init();
};

export const closeUsersModule = () => {
  return usersApp.close();
};
