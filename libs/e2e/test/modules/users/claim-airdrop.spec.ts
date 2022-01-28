import { CampaignType } from '@castcle-api/database';
import { Campaign } from '@castcle-api/database/schemas';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'supertest';
import { UsersRequest } from '../../requests';
import { campaignModel, userAlpha, userBeta } from '../../variables';

export const testUsersClaimAirdrop = () => {
  it('should return validation failed when sending empty request body', () => {
    return UsersRequest.claimAirdrop()
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({})
      .expect(({ body }) => {
        expect(body.message).toEqual(['campaign must be a valid enum value']);
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return UNAUTHORIZED when sending request without credential', () => {
    return UsersRequest.claimAirdrop()
      .send({ campaign: CampaignType.VERIFY_MOBILE })
      .expect(({ body }) => {
        expect(body.message).toEqual(
          'Sorry, Something went wrong. Please try again.'
        );
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should return NOT_FOUND when campaign does not exist or expired', () => {
    return UsersRequest.claimAirdrop()
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ campaign: CampaignType.VERIFY_MOBILE })
      .expect(({ body }) => {
        expect(body.message).toEqual('This campaign has not started');
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should return REWARD_IS_NOT_ENOUGH when reward is not enough to claim', async () => {
    const campaign = await new campaignModel({
      name: 'Early Caster Airdrop',
      type: CampaignType.VERIFY_MOBILE,
      startDate: new Date('2022-01-17T00:00Z'),
      endDate: new Date('3000-01-20T23:59Z'),
      maxClaims: 1,
      rewardsPerClaim: 10,
      rewardBalance: 0,
      totalRewards: 100_000,
    }).save();

    await UsersRequest.claimAirdrop()
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ campaign: CampaignType.VERIFY_MOBILE })
      .expect(({ body }) => {
        expect(body.message).toEqual('The reward is not enough');
      })
      .expect(HttpStatus.BAD_REQUEST);

    await campaign.deleteOne();
  });

  describe('Verify Mobile Campaign', () => {
    let campaign: Campaign;
    let claimAirdropResponse: Response;

    beforeAll(async () => {
      campaign = await new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.VERIFY_MOBILE,
        startDate: new Date('2022-01-17T00:00Z'),
        endDate: new Date('3000-01-20T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
      }).save();

      claimAirdropResponse = await UsersRequest.claimAirdrop()
        .auth(userAlpha.accessToken, { type: 'bearer' })
        .send({ campaign: CampaignType.VERIFY_MOBILE });
    });

    afterAll(async () => {
      await campaign.deleteOne();
    });

    it('should return NO_CONTENT when airdrop claim has been submitted successfully', async () => {
      expect(claimAirdropResponse.body).toEqual({});
      expect(claimAirdropResponse.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should return REACHED_MAX_CLAIMS when user reached the maximum limit of claims', async () => {
      return UsersRequest.claimAirdrop()
        .auth(userAlpha.accessToken, { type: 'bearer' })
        .send({ campaign: CampaignType.VERIFY_MOBILE })
        .expect(({ body }) => {
          expect(body.message).toEqual('Reached the maximum limit of claims');
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return NOT_ELIGIBLE when users mobile not verified', async () => {
      await UsersRequest.claimAirdrop()
        .auth(userBeta.accessToken, { type: 'bearer' })
        .send({ campaign: CampaignType.VERIFY_MOBILE })
        .expect(({ body }) => {
          expect(body.message).toEqual('Not eligible for this campaign');
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
};
