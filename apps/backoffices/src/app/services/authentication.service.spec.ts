import { BackofficeDatabaseModule } from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { StaffRole } from '../models/authentication.enum';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { AuthenticationService } from './authentication.service';

describe('Authentication', () => {
  let service: AuthenticationService;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    global.mongoUri = mongod.getUri();
    moduleRef = await Test.createTestingModule({
      imports: [BackofficeDatabaseModule, BackOfficeMongooseForFeatures],
      providers: [AuthenticationService, Mailer],
    }).compile();

    service = moduleRef.get<AuthenticationService>(AuthenticationService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Manage User', () => {
    it('should return empty when staff not exist', async () => {
      const staffs = await service.getStaffs();
      expect(staffs).toHaveLength(0);
    });

    it('should be create user', async () => {
      const newUser = await service.createStaffFromEmail({
        email: 'test@gmail.com',
        firstName: 'test',
        lastName: 'test',
        role: StaffRole.ADMINISTRATOR,
      });

      expect(newUser).toBeDefined();
    });

    it('should get staff after created', async () => {
      const staffs = await service.getStaffs();
      expect(staffs).toHaveLength(1);
    });

    it('should reset password staff', async () => {
      const oldStaff = await service.getStaffs();
      const newStaff = await service.resetPassword(oldStaff[0]._id);
      expect(oldStaff[0].password).not.toEqual(newStaff.password);
    });

    it('should remove user', async () => {
      const staff = await service.getStaffs();
      await expect(service.deleteStaff(staff[0]._id)).resolves.toBeUndefined();
    });

    it('should return empty after delete user', async () => {
      const staffs = await service.getStaffs();
      expect(staffs).toHaveLength(0);
    });
  });
});
