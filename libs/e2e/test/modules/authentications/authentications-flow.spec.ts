import * as mongoose from 'mongoose';
import { User } from '../../models/user.model';
import { AuthenticationsRequest } from '../../requests';
import {
  accountActivationModel,
  accountDeviceModel,
  userModel,
} from '../../variables';
export const testAuthenticationsFlow = () => {
  const userRegister = new User({ name: 'castcleE2E' });
  describe('#register member flow', () => {
    it('should register successful', async () => {
      await AuthenticationsRequest.guestLogin()
        .send({ deviceUUID: userRegister.deviceUUID })
        .expect(({ body }) => {
          expect(body.accessToken).toBeDefined();
          expect(body.refreshToken).toBeDefined();

          userRegister.guestToken = body.accessToken;
        });

      await AuthenticationsRequest.register()
        .auth(userRegister.guestToken, { type: 'bearer' })
        .send(userRegister.toRegisterPayload())
        .expect(async ({ body }) => {
          expect(body.message).toBeUndefined();
          expect(body.accessToken).toBeDefined();
          expect(body.profile.id).toBeDefined();
          expect(body.profile.castcleId).toEqual(userRegister.castcleId);
          expect(body.profile.displayName).toEqual(userRegister.displayName);
          expect(body.profile.email).toEqual(userRegister.email);
          userRegister.accessToken = body.accessToken;
          userRegister.id = body.profile.id;
        });
    });

    it('should verify email and login successful', async () => {
      const user = await userModel.findOne({
        _id: mongoose.Types.ObjectId(userRegister.id),
      });
      userRegister.accountId = user.ownerAccount as unknown as string;
      const activateAccount = await accountActivationModel.findOne({
        account: userRegister.accountId as any,
      });
      await AuthenticationsRequest.verificationEmail()
        .auth(activateAccount.verifyToken, { type: 'bearer' })
        .send();

      await AuthenticationsRequest.memberLogin()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(userRegister.toMemberLoginPayload())
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
          expect(body.accessToken).toBeDefined();
          expect(body.profile.id).toBeDefined();
          expect(body.profile.castcleId).toEqual(userRegister.castcleId);
          expect(body.profile.displayName).toEqual(userRegister.displayName);
          expect(body.profile.email).toEqual(userRegister.email);
          expect(body.profile.verified.email).toEqual(true);
          userRegister.accessToken = body.accessToken;
          userRegister.id = body.profile.id;
          userRegister.refreshToken = body.refreshToken;
        });
    });

    it('should refresh token successful', async () => {
      await AuthenticationsRequest.refreshToken()
        .auth(userRegister.refreshToken, { type: 'bearer' })
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
          expect(body.accessToken).toBeDefined();
          expect(body.profile.id).toBeDefined();
          expect(body.profile.castcleId).toEqual(userRegister.castcleId);
          expect(body.profile.displayName).toEqual(userRegister.displayName);
          expect(body.profile.email).toEqual(userRegister.email);
          expect(body.profile.verified.email).toEqual(true);
          userRegister.accessToken = body.accessToken;
          userRegister.id = body.profile.id;
        });
    });
  });

  describe('#change password flow', () => {
    let refCode = '';
    const newPassword = 'n+4H&uME63gKv[=-new';
    it('should verificationPassword successful', async () => {
      await AuthenticationsRequest.verificationPassword()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(userRegister.toVerificationPasswordPayload())
        .expect(async ({ body }) => {
          expect(body.refCode).toBeDefined();
          expect(body.expiresTime).toBeDefined();
          expect(body.objective).toEqual('change_password');
          refCode = body.refCode;
        });
    });

    it('should change password successful', async () => {
      await AuthenticationsRequest.changePasswordSubmit()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send({
          objective: 'change_password',
          refCode: refCode,
          newPassword: newPassword,
        });

      await AuthenticationsRequest.memberLogin()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send({
          username: userRegister.email,
          password: newPassword,
        })
        .expect(({ body }) => {
          expect(body.message).toBeUndefined();
          expect(body.accessToken).toBeDefined();
          expect(body.profile.id).toBeDefined();
          expect(body.profile.castcleId).toEqual(userRegister.castcleId);
          expect(body.profile.displayName).toEqual(userRegister.displayName);
          expect(body.profile.email).toEqual(userRegister.email);
          expect(body.profile.verified.email).toEqual(true);
          userRegister.accessToken = body.accessToken;
          userRegister.id = body.profile.id;
          userRegister.refreshToken = body.refreshToken;
        });
    });
  });

  describe('#register & unregister firebase token flow', () => {
    const requestBody = {
      uuid: '196c10cd-2d1d-47a5-9700-3b57e7e34386',
      platform: 'ios',
      firebaseToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    };
    it('should register firebase token successful', async () => {
      await AuthenticationsRequest.registerToken()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(requestBody);
      const accountDevice = await accountDeviceModel
        .findOne(requestBody)
        .exec();
      expect(requestBody).toBeTruthy();
      expect(requestBody.uuid).toEqual(accountDevice.uuid);
      expect(requestBody.platform).toEqual(accountDevice.platform);
      expect(requestBody.firebaseToken).toEqual(accountDevice.firebaseToken);
    });

    it('should unregister firebase token successful', async () => {
      await AuthenticationsRequest.unregisterToken()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(requestBody);
      const accountDevice = await accountDeviceModel
        .findOne(requestBody)
        .exec();

      expect(accountDevice).toBeNull();
    });
  });

  describe('#suggest castcle id flow', () => {
    it('should return lowercase castcle name to suggest castcle id', async () => {
      const requestBody = {
        displayName: 'DisPlayName1234',
      };
      await AuthenticationsRequest.suggestCastcleId()
        .send(requestBody)
        .expect(async ({ body }) => {
          expect(body.suggestCastcleId).toEqual('displayname1234');
        });
    });
  });
};
