import {
  DatabaseModule,
  Metadata,
  MetadataType,
  ReportingSubject,
} from '@castcle-api/database';
import {
  CastcleBackofficeMongooseModule,
  Environment,
} from '@castcle-api/environments';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { MetadataBackofficeService } from './metadata.service';

describe('MetadataBackofficeService', () => {
  let service: MetadataBackofficeService;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    global.mongoUri = mongod.getUri();
    moduleRef = await Test.createTestingModule({
      imports: [
        CastcleBackofficeMongooseModule,
        DatabaseModule,
        BackOfficeMongooseForFeatures,
      ],
      providers: [MetadataBackofficeService],
    }).compile();

    service = moduleRef.get(MetadataBackofficeService);

    const metadataModel = moduleRef.get<Model<Metadata<ReportingSubject>>>(
      getModelToken('Metadata'),
    );
    const staffRoleModel = moduleRef.get<Model<Metadata<ReportingSubject>>>(
      getModelToken('StaffRoles', Environment.BACKOFFICE_DB_DATABASE_NAME),
    );

    await new staffRoleModel({
      slug: 'administrator',
      name: 'Administrator',
    }).save();

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
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Metadata', () => {
    it('should return staffroles', async () => {
      const staffs = await service.getStaffRoles();
      expect(staffs).toHaveLength(1);
    });

    it('should return report subject', async () => {
      const staffs = await service.getReportSubjects();
      expect(staffs).toHaveLength(1);
    });
  });
});
