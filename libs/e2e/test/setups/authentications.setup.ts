/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthenticationModule } from '../../../../apps/authentications/src/app/app.module';
import { authenticationApp } from '../variables';

export const setupAuthenticationsModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AuthenticationModule]
  }).compile();

  (authenticationApp as any) = moduleFixture.createNestApplication();

  authenticationApp.useGlobalPipes(new ValidationPipe());
  authenticationApp.useGlobalFilters(new ExceptionFilter());
  authenticationApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name
  });

  await authenticationApp.init();
};

export const closeAuthenticationsModule = async () => {
  await authenticationApp.close();
};
