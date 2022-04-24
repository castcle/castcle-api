import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/users/src/app/app.module';
import { pagesApp } from '../variables';

export const setupPagesModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  (pagesApp as any) = moduleFixture.createNestApplication();

  pagesApp.useGlobalPipes(new ValidationPipe());
  pagesApp.useGlobalFilters(new ExceptionFilter());
  pagesApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await pagesApp.init();
};

export const closePagesModule = () => {
  return pagesApp.close();
};
