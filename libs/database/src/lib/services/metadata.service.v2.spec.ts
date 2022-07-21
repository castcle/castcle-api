import { HttpModule } from '@nestjs/axios';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MetadataServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { MetadataType } from '../models';
import { Repository } from '../repositories';

describe('MetadataServiceV2', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let service: MetadataServiceV2;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [MetadataServiceV2, Repository],
    }).compile();

    service = moduleRef.get(MetadataServiceV2);
    const metadataModel = moduleRef.get(getModelToken('Metadata'));

    await new metadataModel({
      type: MetadataType.REPORTING_SUBJECT,
      payload: {
        slug: 'spam',
        name: 'Spam',
        order: 1,
      },
    }).save();
  });

  afterAll(async () => {
    await Promise.all([moduleRef.close(), mongod.stop()]);
  });
  describe('getReportSubjects', () => {
    it('should get reporting subjects', async () => {
      const expectSubject = {
        slug: 'spam',
        name: 'Spam',
        order: 1,
      };
      const reportSubjects = await service.getAllReportSubjects();

      expect(reportSubjects[0].payload).toEqual(expectSubject);

      expect(reportSubjects).toHaveLength(1);
    });
  });
});
