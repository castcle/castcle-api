import { Configs } from '@castcle-api/environments';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/users/src/app/app.module';
import { apps } from '../variables';

export const setupPagesModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  apps.pages = moduleFixture.createNestApplication();
  apps.pages.useGlobalPipes(new ValidationPipe());
  apps.pages.useGlobalFilters(new CastcleExceptionFilter());
  apps.pages.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await apps.pages.init();
};

export const closePagesModule = () => {
  return apps.pages.close();
};
