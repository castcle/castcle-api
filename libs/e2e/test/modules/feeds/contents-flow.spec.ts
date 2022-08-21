import { ShortPayload } from '../../../../database/src/lib/dtos/content.dto';
import { User } from '../../models';
import { AuthenticationsRequest, ContentsRequest } from '../../requests';
import { userAlpha, userGamma } from '../../variables';

export const testContentsFlow = () => {
  const userA = new User({ name: 'ContentA' });
  let contentId;
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

  it('STEP 1: Create Content should create content successful', async () => {
    const shortPayload = {
      message: 'Hi Castcle',
    } as ShortPayload;

    const requst = {
      payload: shortPayload,
      type: 'short',
      castcleId: userGamma.castcleId,
    };
    await ContentsRequest.createContent()
      .auth(userGamma.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload).toBeDefined();
        contentId = body.payload.id;
      });
  });

  it('STEP 2: GetContent should get content with others user successful', async () => {
    await ContentsRequest.getContent(contentId)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload).toBeDefined();
        contentId = body.payload.id;
      });
  });

  it('STEP 3: UpdateContent should update content successful', async () => {
    const updateContentPayload = {
      message: 'Hello World Update',
    } as ShortPayload;
    const requst = {
      payload: updateContentPayload,
      type: 'short',
      castcleId: userGamma.castcleId,
    };

    await ContentsRequest.updateContent(contentId)
      .auth(userGamma.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload.message).toEqual('Hello World Update');
        expect(body.payload).toBeDefined();
        contentId = body.payload.id;
      });

    await ContentsRequest.getContent(contentId)
      .auth(userGamma.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload.message).toEqual('Hello World Update');
        expect(body.payload).toBeDefined();
        contentId = body.payload.id;
      });
  });

  it('STEP 4: DeleteContent should delete content successful', async () => {
    await ContentsRequest.deleteContent(contentId).auth(userGamma.accessToken, {
      type: 'bearer',
    });

    await ContentsRequest.getContent(contentId)
      .auth(userGamma.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload).toEqual({});
      });
  });
};
