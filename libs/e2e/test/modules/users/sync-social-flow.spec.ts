import { SocialProvider } from '@castcle-api/database';
import { User } from '../../models';
import {
  AuthenticationsRequest,
  PageRequest,
  UsersRequest,
} from '../../requests';
import { userAlpha } from '../../variables';

export const testSyncSocialFlow = () => {
  const user = new User({ name: 'socialSync', referrer: userAlpha.castcleId });
  let socialSync;
  beforeAll(async () => {
    await AuthenticationsRequest.guestLogin()
      .send({ deviceUUID: user.deviceUUID })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();

        user.guestToken = body.accessToken;
      });

    await AuthenticationsRequest.register()
      .auth(user.guestToken, { type: 'bearer' })
      .send(user.toRegisterPayload())
      .expect(async ({ body }) => {
        expect(body.message).toBeUndefined();
        expect(body.accessToken).toBeDefined();
        expect(body.profile.id).toBeDefined();
        expect(body.profile.castcleId).toEqual(user.castcleId);
        expect(body.profile.displayName).toEqual(user.displayName);
        expect(body.profile.email).toEqual(user.email);

        user.accessToken = body.accessToken;
        user.id = body.profile.id;
      });
  });

  it('STEP 1: SyncSocial should connect social successful', async () => {
    const request = {
      payload: [
        {
          castcleId: 't12345678',
          provider: SocialProvider.Twitter,
          socialId: 't12345678',
          userName: 't12345678',
          displayName: 'mock tw',
          overview: 'hi I am mock',
          link: 'http://www.twitter.com/t12345678',
          authToken: '24234dfgdfghjkl3;4k242',
        },
        {
          provider: SocialProvider.Facebook,
          socialId: 'fb001',
          userName: 'fb_test1',
          displayName: 'test1',
          overview: 'facebook sync 1',
          link: 'http://www.facebook.com/test1',
          authToken: '24234dfgdfghjkl3;4k2428989899989',
        },
      ],
    };

    await UsersRequest.syncSocial()
      .auth(user.accessToken, { type: 'bearer' })
      .send(request)
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(2);
        expect(body.payload[0].links.twitter).toBeDefined();
        expect(body.payload[0].socialSyncs).toBeDefined();
        expect(body.payload[1].links.facebook).toBeDefined();
        expect(body.payload[1].socialSyncs).toBeDefined();
      });
  });

  it('STEP 2: GetSyncSocial should lookup sync social successful', async () => {
    await UsersRequest.syncSocialLookup()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(2);
        expect(body.payload.filter((x) => x.autoPost).length).toEqual(2);
        expect(body.payload.filter((x) => x.active).length).toEqual(2);
        expect(
          body.payload.find((x) => x.provider === 'twitter'),
        ).toBeDefined();
        expect(
          body.payload.find((x) => x.provider === 'facebook'),
        ).toBeDefined();
        socialSync = body;
      });
  });

  it('STEP 3: CancelAutoPost should cancel auto post successful', async () => {
    const socialSyncId = socialSync.payload.find(
      (x) => x.provider === 'facebook',
    ).id;
    await UsersRequest.cancelAutoPost(socialSyncId).auth(user.accessToken, {
      type: 'bearer',
    });
    await UsersRequest.syncSocialLookup()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(
          body.payload.find((x) => x.id === socialSyncId).autoPost,
        ).toEqual(false);
      });
  });

  it('STEP 4: SetAutoPost should set auto post successful', async () => {
    const socialSyncId = socialSync.payload.find(
      (x) => x.provider === 'facebook',
    ).id;
    await UsersRequest.setAutoPost(socialSyncId).auth(user.accessToken, {
      type: 'bearer',
    });
    await UsersRequest.syncSocialLookup()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(
          body.payload.find((x) => x.id === socialSyncId).autoPost,
        ).toEqual(true);
      });
  });

  it('STEP 5: DisconnectSyncSocial should disconnect sync social successful', async () => {
    const socialSyncId = socialSync.payload.find(
      (x) => x.provider === 'facebook',
    ).id;
    await UsersRequest.disconnectSocial(socialSyncId).auth(user.accessToken, {
      type: 'bearer',
    });
    await UsersRequest.syncSocialLookup()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.filter((x) => !x.active).length).toEqual(1);
        expect(body.payload.find((x) => x.id === socialSyncId).active).toEqual(
          false,
        );
        expect(
          body.payload.find((x) => x.id === socialSyncId).autoPost,
        ).toEqual(false);
      });
  });

  it('STEP 6: ConnectSyncSocial should connet sync social successful', async () => {
    const socialSyncId = socialSync.payload.find(
      (x) => x.provider === 'facebook',
    ).id;
    const request = {
      payload: {
        socialId: 't12345678',
        userName: 't12345678',
        displayName: 'mock tw',
        overview: 'hi I am mock connect',
        link: 'http://www.twitter.com/t12345678',
        authToken: '24234dfgdfghjkl3;4k242',
        provider: SocialProvider.Twitter,
        castcleId: 't12345678',
        active: true,
        autoPost: true,
      },
    };
    await UsersRequest.reconnectSocial(socialSyncId)
      .auth(user.accessToken, { type: 'bearer' })
      .send(request);

    await UsersRequest.syncSocialLookup()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.filter((x) => x.active).length).toEqual(2);
        expect(body.payload.find((x) => x.id === socialSyncId).active).toEqual(
          true,
        );
        expect(
          body.payload.find((x) => x.id === socialSyncId).autoPost,
        ).toEqual(true);
      });
  });

  it('STEP 7: Delete page successful', async () => {
    let allPages;
    await UsersRequest.getMyPages()
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        allPages = body.payload;
      });

    await PageRequest.deletePage(allPages[0].id)
      .auth(user.accessToken, { type: 'bearer' })
      .send({ password: user.password });

    await PageRequest.getPage(allPages[0].id)
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.castcleId).toBeUndefined();
      });

    await PageRequest.getPage(allPages[1].id)
      .auth(user.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.castcleId).toBeDefined();
      });
  });
};
