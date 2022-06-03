import { EntityVisibility } from '../../../../database/src/lib/dtos';
import { User } from '../../models';
import { AuthenticationsRequest, UsersRequest } from '../../requests';
import {
  relationshipModel,
  userAlpha,
  userBeta,
} from '../../variables/global.variable';

export const testFollowsFlow = () => {
  const userA = new User({ name: 'followA' });
  beforeAll(async () => {
    await AuthenticationsRequest.guestLogin()
      .send({ deviceUUID: userA.deviceUUID })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();

        userA.guestToken = body.accessToken;
      });

    await AuthenticationsRequest.register()
      .auth(userA.guestToken, { type: 'bearer' })
      .send(userA.toRegisterPayload())
      .expect(async ({ body }) => {
        expect(body.message).toBeUndefined();
        expect(body.accessToken).toBeDefined();
        expect(body.profile.id).toBeDefined();
        expect(body.profile.castcleId).toEqual(userA.castcleId);
        expect(body.profile.displayName).toEqual(userA.displayName);
        expect(body.profile.email).toEqual(userA.email);

        userA.accessToken = body.accessToken;
        userA.id = body.profile.id;
      });
  });

  it('STEP 1: FollowUser should follow user successful', async () => {
    const request = {
      targetCastcleId: userAlpha.castcleId,
    };

    await UsersRequest.followUser(userBeta.castcleId)
      .auth(userBeta.accessToken, { type: 'bearer' })
      .send(request)
      .expect(204);
    await UsersRequest.followUser(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(request)
      .expect(204);

    await UsersRequest.getFollowers(userAlpha.castcleId)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .expect(({ body }) => {
        expect(body.payload.length).toEqual(2);
        expect(body.meta.resultTotal).toEqual(2);
        expect(
          body.payload.find((x) => x.castcleId === userBeta.castcleId),
        ).toBeDefined();
        expect(
          body.payload.find((x) => x.castcleId === userA.castcleId),
        ).toBeDefined();
      });
  });

  it('STEP 2: GetFollow should get follower successful', async () => {
    await UsersRequest.getFollowers(userAlpha.castcleId)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(2);
        expect(body.meta.resultTotal).toEqual(2);
        expect(
          body.payload.find((x) => x.castcleId === userBeta.castcleId),
        ).toBeDefined();
        expect(
          body.payload.find((x) => x.castcleId === userA.castcleId),
        ).toBeDefined();
      });

    await UsersRequest.getFollowing(userBeta.castcleId)
      .auth(userBeta.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.meta.resultTotal).toEqual(1);
        expect(
          body.payload.find((x) => x.castcleId === userAlpha.castcleId),
        ).toBeDefined();
      });

    await UsersRequest.getFollowing(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.meta.resultTotal).toEqual(1);
        expect(
          body.payload.find((x) => x.castcleId === userAlpha.castcleId),
        ).toBeDefined();
      });
  });

  it('STEP 3: Unfollow should unfollow successful', async () => {
    await UsersRequest.unfollow(userBeta.castcleId, userAlpha.castcleId).auth(
      userBeta.accessToken,
      { type: 'bearer' },
    );

    await UsersRequest.getFollowing(userBeta.castcleId)
      .auth(userBeta.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(0);
        expect(body.meta.resultTotal).toEqual(0);
        expect(
          body.payload.find((x) => x.castcleId === userAlpha.castcleId),
        ).toBeUndefined();
      });

    const relationship = await relationshipModel
      .findOne({
        followedUser: userAlpha.id as any,
        following: true,
        visibility: EntityVisibility.Publish,
      })
      .exec();
    expect(relationship.user.toString()).toEqual(userA.id);
  });
};
