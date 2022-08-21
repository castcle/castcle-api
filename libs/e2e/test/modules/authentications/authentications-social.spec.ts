import { HttpStatus } from '@nestjs/common';
import { User } from '../../models/user.model';
import { AuthenticationsRequest } from '../../requests';

export const testAuthenticationsSocialFlow = () => {
  describe('#register with social flow', () => {
    it('should login social successful', async () => {
      const userRegister = new User({ name: 'castcleE2ESocial' });
      const request = {
        provider: 'facebook',
        socialId: '109364223',
        displayName: 'test facebook',
        avatar: '',
        email: 'testfb@gmail.com',
        authToken: 'auth-token',
      };
      await AuthenticationsRequest.guestLogin()
        .send({ deviceUUID: userRegister.deviceUUID })
        .expect(({ body }) => {
          expect(body.accessToken).toBeDefined();
          expect(body.refreshToken).toBeDefined();

          userRegister.guestToken = body.accessToken;
        });

      await AuthenticationsRequest.loginWithSocial()
        .auth(userRegister.guestToken, { type: 'bearer' })
        .send(request)
        .expect(async ({ body }) => {
          expect(body.accessToken).toBeDefined();
          expect(body.profile.verified.social).toEqual(true);
          userRegister.accessToken = body.accessToken;
          userRegister.id = body.profile.id;
        });
    });

    it('should connect social successful', async () => {
      const userRegister = new User({ name: 'castcleE2ESocialConnect' });
      const request = {
        provider: 'twitter',
        socialId: '10936456999',
        displayName: 'test twitter',
        avatar: '',
        email: userRegister.email,
        authToken: 'auth-token',
      };
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

      await AuthenticationsRequest.connectWithSocial()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(request)
        .expect(async ({ body }) => {
          expect(body.accessToken).toBeDefined();
          expect(body.profile.verified.social).toEqual(true);
          userRegister.accessToken = body.accessToken;
        });
    });

    it('should connect social successful when exception from loginWithSocial', async () => {
      const userRegister = new User({ name: 'castcleE2ESocialConnect2' });
      const request = {
        provider: 'facebook',
        socialId: '10936456999',
        displayName: 'test2 facebook',
        avatar: '',
        email: userRegister.email,
        authToken: 'auth-token',
      };
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

      await AuthenticationsRequest.loginWithSocial()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(request)
        .expect(async ({ body }) => {
          expect(body.payload.profile).toBeDefined();
          expect(HttpStatus.BAD_REQUEST);
          expect(body.code).toEqual('3021');
        });

      await AuthenticationsRequest.connectWithSocial()
        .auth(userRegister.accessToken, { type: 'bearer' })
        .send(request)
        .expect(async ({ body }) => {
          expect(body.accessToken).toBeDefined();
          expect(body.profile.verified.social).toEqual(true);
          userRegister.accessToken = body.accessToken;
        });
    });
  });
};
