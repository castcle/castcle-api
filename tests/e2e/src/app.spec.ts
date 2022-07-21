import { TwilioClient } from '@castcle-api/utils/clients';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule as AnalyticsModule } from 'apps/analytics/src/app/app.module';
import { AppModule as AuthModule } from 'apps/authentications/src/app/app.module';
import { AppModule as FeedsModule } from 'apps/feeds/src/app/app.module';
import { AppModule as UsersModule } from 'apps/users/src/app/app.module';
import { TwilioClientMock } from 'libs/utils/clients/src/lib/twilio/twilio.client.mock';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Query } from 'mongoose';
import { testReviewTransaction } from './routes/review-transaction.spec';
import { testSendTransaction } from './routes/send-transaction.spec';
import { request } from './utils.spec';

describe('Castcle E2E Tests', () => {
  let app: NestFastifyApplication;
  let mongoServer: MongoMemoryReplSet;
  let cleanUpMongoServer: Query<any, any>[];

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create();
    global.mongoUri = mongoServer.getUri();
    const moduleRef = await Test.createTestingModule({
      imports: [AnalyticsModule, AuthModule, FeedsModule, UsersModule],
    })
      .overrideProvider(TwilioClient)
      .useClass(TwilioClientMock)
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.useGlobalFilters(new CastcleExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    global.__APP__ = app;
    cleanUpMongoServer = Object.keys(
      app.get(getConnectionToken()).base.modelSchemas,
    ).map((name) => app.get(getModelToken(name)).deleteMany({}));
  });

  beforeEach(async () => {
    await Promise.all(cleanUpMongoServer);
  });

  afterAll(async () => {
    await Promise.all([app.close(), mongoServer.stop()]);
  });

  it('should be defined and status OK', () => {
    expect(app.getHttpServer()).toBeDefined();

    return Promise.all([
      request().get('/analytics/healthy').expect('').expect(200),
      request().get('/authentications/healthy').expect('').expect(200),
      request().get('/feeds/healthy').expect('').expect(200),
      request().get('/users/healthy').expect('').expect(200),
    ]);
  });

  testReviewTransaction();
  testSendTransaction();
});
