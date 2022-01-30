import { AuthenticationsRequest } from '../../requests';
import { userAlpha, userBeta } from '../../variables';

export const initializeUsers = async () => {
  await AuthenticationsRequest.guestLogin()
    .send({ deviceUUID: userAlpha.deviceUUID })
    .expect(({ body }) => {
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      userAlpha.guestToken = body.accessToken;
    });

  await AuthenticationsRequest.guestLogin()
    .send({ deviceUUID: userBeta.deviceUUID })
    .expect(({ body }) => {
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      userBeta.guestToken = body.accessToken;
    });

  await AuthenticationsRequest.register()
    .auth(userAlpha.guestToken, { type: 'bearer' })
    .send(userAlpha.toRegisterPayload())
    .expect(({ body }) => {
      expect(body.message).toBeUndefined();
      expect(body.accessToken).toBeDefined();
      expect(body.profile.id).toBeDefined();
      expect(body.profile.castcleId).toEqual(userAlpha.castcleId);
      expect(body.profile.displayName).toEqual(userAlpha.displayName);
      expect(body.profile.email).toEqual(userAlpha.email);

      userAlpha.accessToken = body.accessToken;
      userAlpha.id = body.profile.id;
    });

  await AuthenticationsRequest.register()
    .auth(userBeta.guestToken, { type: 'bearer' })
    .send(userBeta.toRegisterPayload())
    .expect(({ body }) => {
      expect(body.message).toBeUndefined();
      expect(body.accessToken).toBeDefined();
      expect(body.profile.id).toBeDefined();
      expect(body.profile.castcleId).toEqual(userBeta.castcleId);
      expect(body.profile.displayName).toEqual(userBeta.displayName);
      expect(body.profile.email).toEqual(userBeta.email);

      userBeta.accessToken = body.accessToken;
      userBeta.id = body.profile.id;
    });
};
