import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthenticationModule } from '../../../../apps/authentications/src/app/app.module';
import { authenticationsApp } from '../variables';

export const setupAuthenticationsModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AuthenticationModule],
  }).compile();

  (authenticationsApp as any) = moduleFixture.createNestApplication();

  authenticationsApp.useGlobalPipes(new ValidationPipe());
  authenticationsApp.useGlobalFilters(new ExceptionFilter());
  authenticationsApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await authenticationsApp.init();
};

export const closeAuthenticationsModule = () => {
  return authenticationsApp.close();
};
