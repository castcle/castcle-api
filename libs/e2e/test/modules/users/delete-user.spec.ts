import { HttpStatus } from '@nestjs/common';
import { User } from '../../models';
import { AuthenticationsRequest, UsersRequest } from '../../requests';
import { userAlpha } from '../../variables';

export const testUsersDeleteUser = () => {
  const tempUser = new User({
    name: 'TempUserToDelete',
    referrer: userAlpha.castcleId,
  });

  beforeAll(async () => {
    await AuthenticationsRequest.guestLogin()
      .send({ deviceUUID: tempUser.deviceUUID })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();

        tempUser.guestToken = body.accessToken;
      });

    await AuthenticationsRequest.register()
      .auth(tempUser.guestToken, { type: 'bearer' })
      .send(tempUser.toRegisterPayload())
      .expect(async ({ body }) => {
        expect(body.message).toBeUndefined();
        expect(body.accessToken).toBeDefined();
        expect(body.profile.id).toBeDefined();
        expect(body.profile.castcleId).toEqual(tempUser.castcleId);
        expect(body.profile.displayName).toEqual(tempUser.displayName);
        expect(body.profile.email).toEqual(tempUser.email);

        tempUser.accessToken = body.accessToken;
        tempUser.id = body.profile.id;
      });
  });

  it('should return UNAUTHORIZED when sending request without credential', () => {
    return UsersRequest.deleteUser()
      .expect(({ body }) => {
        expect(body.message).toEqual('Missing Authorization header.');
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should return BAD_REQUEST when sending invalid request body', () => {
    return UsersRequest.deleteUser()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({})
      .expect(({ body }) => {
        expect(body.message.sort()).toEqual(
          ['password must be a string', 'password should not be empty'].sort(),
        );
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return INVALID_PASSWORD when password mismatched', () => {
    return UsersRequest.deleteUser()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({ password: '12341234' })
      .expect(({ body }) => {
        expect(body.message).toEqual('Incorrect password. Please try again.');
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it(`should return NO_CONTENT and delete all user's data`, () => {
    return UsersRequest.deleteUser()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({ password: tempUser.password })
      .expect(({ body }) => {
        expect(body.message).toBeUndefined();
      })
      .expect(HttpStatus.NO_CONTENT);
  });
};
