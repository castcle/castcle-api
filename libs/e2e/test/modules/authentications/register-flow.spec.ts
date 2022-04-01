import * as mongoose from 'mongoose';
import { User } from '../../models/user.model';
import { AuthenticationsRequest } from '../../requests';
import { accountActivationModel, userModel } from '../../variables';
export const testRegisterFlow = () => {
  const userRegister = new User({ name: 'castcleE2E' });
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
};
