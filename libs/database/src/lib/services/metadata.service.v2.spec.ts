import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
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

    service = moduleRef.get<MetadataServiceV2>(MetadataServiceV2);

    await new (service as any).repository.reportingSubjectModel({
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
      const reportSubjects = await (service as any).getReportSubjects();

      expect(reportSubjects).toHaveLength(1);
    });
  });
});
