import { Configs } from '@castcle-api/environments';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/feeds/src/app/app.module';
import { apps } from '../variables';

export const setupFeedsModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  apps.feeds = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  apps.feeds.useGlobalPipes(new ValidationPipe());
  apps.feeds.useGlobalFilters(new CastcleExceptionFilter());
  apps.feeds.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await apps.feeds.init();
  await apps.feeds.getHttpAdapter().getInstance().ready();
};

export const closeFeedsModule = () => {
  return apps.feeds.close();
};
