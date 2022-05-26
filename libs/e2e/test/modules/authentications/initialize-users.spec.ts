import * as mongoose from 'mongoose';
import { AuthenticationsRequest } from '../../requests';
import { guest, userAlpha, userBeta, userModel } from '../../variables';
import {
  accountActivationModel,
  userGamma,
} from '../../variables/global.variable';

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

  await AuthenticationsRequest.guestLogin()
    .send({ deviceUUID: guest.deviceUUID })
    .expect(({ body }) => {
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      guest.guestToken = body.accessToken;
    });

  await AuthenticationsRequest.guestLogin()
    .send({ deviceUUID: userGamma.deviceUUID })
    .expect(({ body }) => {
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      userGamma.guestToken = body.accessToken;
    });

  await AuthenticationsRequest.register()
    .auth(userAlpha.guestToken, { type: 'bearer' })
    .send(userAlpha.toRegisterPayload())
    .expect(async ({ body }) => {
      expect(body.message).toBeUndefined();
      expect(body.accessToken).toBeDefined();
      expect(body.profile.id).toBeDefined();
      expect(body.profile.castcleId).toEqual(userAlpha.castcleId);
      expect(body.profile.displayName).toEqual(userAlpha.displayName);
      expect(body.profile.email).toEqual(userAlpha.email);

      const user = await userModel.findByIdAndUpdate(body.profile.id, {
        'verified.mobile': true,
      });

      userAlpha.accountId = user.ownerAccount as unknown as string;
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

  await AuthenticationsRequest.register()
    .auth(userGamma.guestToken, { type: 'bearer' })
    .send(userGamma.toRegisterPayload())
    .expect(({ body }) => {
      expect(body.message).toBeUndefined();
      expect(body.accessToken).toBeDefined();
      expect(body.profile.id).toBeDefined();
      expect(body.profile.castcleId).toEqual(userGamma.castcleId);
      expect(body.profile.displayName).toEqual(userGamma.displayName);
      expect(body.profile.email).toEqual(userGamma.email);

      userGamma.accessToken = body.accessToken;
      userGamma.id = body.profile.id;
    });

  const user = await userModel.findOne({
    _id: mongoose.Types.ObjectId(userGamma.id),
  });
  userGamma.accountId = user.ownerAccount as unknown as string;
  const activateAccount = await accountActivationModel.findOne({
    account: userGamma.accountId as any,
  });
  await AuthenticationsRequest.verificationEmail()
    .auth(activateAccount.verifyToken, { type: 'bearer' })
    .send();

  await AuthenticationsRequest.memberLogin()
    .auth(userGamma.accessToken, { type: 'bearer' })
    .send(userGamma.toMemberLoginPayload())
    .expect(({ body }) => {
      userGamma.accessToken = body.accessToken;
      userGamma.id = body.profile.id;
      userGamma.refreshToken = body.refreshToken;
    });
};
