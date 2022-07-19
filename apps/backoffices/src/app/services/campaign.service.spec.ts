import { BackofficeDatabaseModule, CampaignType } from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { CampaignBackofficeService } from './campaign.service';

describe('Campaign', () => {
  let service: CampaignBackofficeService;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    global.mongoUri = mongod.getUri();
    moduleRef = await Test.createTestingModule({
      imports: [BackofficeDatabaseModule, BackOfficeMongooseForFeatures],
      providers: [CampaignBackofficeService],
    }).compile();

    service = moduleRef.get(CampaignBackofficeService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Manage Campaign', () => {
    it('should return empty when campaign not exist', async () => {
      const staffs = await service.getCampaigns();
      expect(staffs).toHaveLength(0);
    });

    it('should be create campaign', async () => {
      await expect(
        service.createCampaign({
          name: 'testCampaign',
          type: CampaignType.VERIFY_MOBILE,
          totalRewards: 2000,
          rewardBalance: 2000,
          rewardsPerClaim: 1,
          startDate: new Date(),
          endDate: new Date(),
          maxClaims: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('should be return campaign type is exist', async () => {
      await expect(
        service.createCampaign({
          name: 'testCampaign',
          type: CampaignType.VERIFY_MOBILE,
          totalRewards: 2000,
          rewardBalance: 2000,
          rewardsPerClaim: 1,
          startDate: new Date(),
          endDate: new Date(),
          maxClaims: 1,
        }),
      ).rejects.toEqual(new CastcleException('CAMPAIGN_TYPE_IS_EXIST'));
    });

    it('should be update campaign', async () => {
      const campaign = await service.getCampaigns();
      await expect(
        service.updateCampaign(campaign[0].id, {
          name: 'testCampaign2',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).resolves.toBeUndefined();
    });

    it('should be return campaign type is exist', async () => {
      await expect(
        service.updateCampaign('618cc797c1a2b319dff12095', {
          name: 'testCampaign2',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).rejects.toEqual(new CastcleException('CAMPAIGN_NOT_FOUND'));
    });
  });
});
