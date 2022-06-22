import { Types } from 'mongoose';
import { User } from '../models';
import { AuthenticationsRequest } from '../requests';
import { accountActivationModel, userModel } from '../variables';

export const registerMockUser = async (user: User) => {
  await AuthenticationsRequest.guestLogin()
    .send({ deviceUUID: user.deviceUUID })
    .expect(({ body }) => {
      user.guestToken = body.accessToken;
    });

  await AuthenticationsRequest.register()
    .auth(user.guestToken, { type: 'bearer' })
    .send(user.toRegisterPayload())
    .expect(async ({ body }) => {
      user.accessToken = body.accessToken;
      user.id = body.profile.id;
    });

  const userData = await userModel.findOne({
    _id: Types.ObjectId(user.id),
  });
  user.accountId = userData.ownerAccount as unknown as string;
  const activateAccount = await accountActivationModel.findOne({
    account: user.accountId as any,
  });
  await AuthenticationsRequest.verificationEmail()
    .auth(activateAccount.verifyToken, { type: 'bearer' })
    .send();

  await AuthenticationsRequest.memberLogin()
    .auth(user.accessToken, { type: 'bearer' })
    .send(user.toMemberLoginPayload())
    .expect(({ body }) => {
      user.accessToken = body.accessToken;
      user.id = body.profile.id;
      user.refreshToken = body.refreshToken;
    });
  return user;
};
