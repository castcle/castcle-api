import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/feeds/src/app/app.module';
import { contentsApp } from '../variables';

export const setupContentsModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  (contentsApp as any) = moduleFixture.createNestApplication();

  contentsApp.useGlobalPipes(new ValidationPipe());
  contentsApp.useGlobalFilters(new ExceptionFilter());
  contentsApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await contentsApp.init();
};

export const closeContentsModule = () => {
  return contentsApp.close();
};
