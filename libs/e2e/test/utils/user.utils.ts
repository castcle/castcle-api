import { User } from '../models';
import { AuthenticationsRequest } from '../requests';

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
  return user;
};
