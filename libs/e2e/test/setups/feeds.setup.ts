import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/feeds/src/app/app.module';
import { feedsApp } from '../variables';

export const setupFeedsModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  (feedsApp as any) = moduleFixture.createNestApplication();

  feedsApp.useGlobalPipes(new ValidationPipe());
  feedsApp.useGlobalFilters(new ExceptionFilter());
  feedsApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await feedsApp.init();
};

export const closeFeedsModule = () => {
  return feedsApp.close();
};
