import { HttpModule } from '@nestjs/axios';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MetadataServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
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
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [MetadataServiceV2, Repository],
    }).compile();

    service = moduleRef.get(MetadataServiceV2);
    const reportingSubjectModel = moduleRef.get(
      getModelToken('ReportingSubject'),
    );

    await new reportingSubjectModel({
      slug: 'spam',
      name: 'Spam',
      order: 1,
    }).save();
  });

  afterAll(async () => {
    await Promise.all([moduleRef.close(), mongod.stop()]);
  });
  describe('getReportSubjects', () => {
    it('should get reporting subjects', async () => {
      const reportSubjects = await service.getReportSubjects();

      expect(reportSubjects).toHaveLength(1);
    });
  });
});
