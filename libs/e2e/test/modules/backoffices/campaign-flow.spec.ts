import { BackofficesRequest } from '../../requests';

export const testCampaignFlow = () => {
  let accessToken = '';
  let newCampaign;

  beforeAll(async () => {
    await BackofficesRequest.login()
      .send({
        email: 'test@castcle.com',
        password: 'test',
      })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        accessToken = body.accessToken;
      });
  });

  it('STEP 1: Should return empty campaign', async () => {
    await BackofficesRequest.getCampaigns()
      .auth(accessToken, { type: 'bearer' })
      .expect(({ body }) => {
        expect(body.payload).toHaveLength(0);
      });
  });

  it('STEP 2: Should create Campaign', async () => {
    await BackofficesRequest.createCampaign()
      .auth(accessToken, { type: 'bearer' })
      .send({
        name: 'testjaja',
        type: 'verify-mobile',
        totalRewards: 2000,
        rewardBalance: 2000,
        rewardsPerClaim: 2000,
        test: 2000,
        startDate: new Date(),
        endDate: new Date(),
      })
      .expect(({ status }) => {
        expect(status).toEqual(201);
      });
  });

  it('STEP 3: Should get all campaign', async () => {
    await BackofficesRequest.getCampaigns()
      .auth(accessToken, { type: 'bearer' })
      .expect(({ body }) => {
        expect(body.payload).toHaveLength(1);
        newCampaign = body.payload[0];
      });
  });

  it('STEP 4: Should update campaign', async () => {
    await BackofficesRequest.updateCampaign(newCampaign._id)
      .auth(accessToken, { type: 'bearer' })
      .send({
        name: 'changeTest',
        startDate: new Date(),
        endDate: new Date(),
      })
      .expect(({ status }) => {
        expect(status).toEqual(201);
      });
  });

  it('STEP 5: Should throw not found if campaign does not exist', async () => {
    await BackofficesRequest.updateCampaign('62beba95da7ae63fcf187dd3')
      .auth(accessToken, { type: 'bearer' })
      .send({
        name: 'changeTest',
        startDate: new Date(),
        endDate: new Date(),
      })
      .expect(({ status }) => {
        expect(status).toEqual(404);
      });
  });
};
