import { Mailer } from '@castcle-api/utils/clients';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongooseForFeaturesApp, MongooseForFeaturesBO } from '../app.module';
import { AuthenticationService } from './authentication.service';

describe('Authentication', () => {
  let service: AuthenticationService;
  let mongod: MongoMemoryReplSet;
  let module: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseForFeaturesApp,
        MongooseForFeaturesBO,
      ],
      providers: [AuthenticationService, Mailer],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
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
      const newUser = await service.createAccountFromEmail({
        email: 'test@gmail.com',
        firstName: 'test',
        lastName: 'test',
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
      const deleteAction = await service.deleteStaff(staff[0]._id);
      expect(deleteAction.deletedCount).toEqual(1);
    });

    it('should return empty after delete user', async () => {
      const staffs = await service.getStaffs();
      expect(staffs).toHaveLength(0);
    });
  });

  afterAll(async () => {
    await mongod.stop();
  });
});
