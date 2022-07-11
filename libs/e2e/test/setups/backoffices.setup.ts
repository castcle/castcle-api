import { Configs } from '@castcle-api/environments';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Staff } from 'apps/backoffices/src/app/schemas/staff.schema';
import { hashSync } from 'bcryptjs';
import { Model } from 'mongoose';
import { AppModule } from '../../../../apps/backoffices/src/app/app.module';
import { apps } from '../variables';

export const setupBackofficesModule = async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  apps.backoffices =
    moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

  apps.backoffices.useGlobalPipes(new ValidationPipe());
  apps.backoffices.useGlobalFilters(new CastcleExceptionFilter());
  apps.backoffices.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await apps.backoffices.init();
  await apps.backoffices.getHttpAdapter().getInstance().ready();

  const staffModel = moduleFixture.get<Model<Staff>>(getModelToken('Staff'));

  await staffModel.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'test@castcle.com',
    role: 'administrator',
    password: hashSync('test'),
    status: 'active',
  });
};

export const closeBackofficesModule = () => {
  return apps.backoffices.close();
};
