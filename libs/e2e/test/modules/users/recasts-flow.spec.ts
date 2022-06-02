import { ShortPayload } from '@castcle-api/database';
import { User } from '../../models';
import { ContentsRequest, UsersRequest } from '../../requests';
import { registerMockUser } from '../../utils/user.utils';
import { userGamma } from '../../variables/global.variable';

export const testRecastsFlow = () => {
  let userA = new User({ name: 'reCastA' });
  let userB = new User({ name: 'reCastB' });
  let userC = new User({ name: 'reCastC' });
  let contentId;
  beforeAll(async () => {
    userA = await registerMockUser(userA);
    userB = await registerMockUser(userB);
    userC = await registerMockUser(userC);

    const shortPayload = {
      message: 'Hi Castcle Content.',
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

  it('STEP 1: Recast should recasts content successful', async () => {
    const request = {
      contentId: contentId,
    };

    await UsersRequest.recast(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(request)
      .expect(async ({ body }) => {
        console.log(body);
        expect(body.payload).toBeDefined();
        expect(body.includes.casts[0].id).toEqual(request.contentId);
      });

    await UsersRequest.recast(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(request)
      .expect(async ({ body }) => {
        expect(body.payload).toBeDefined();
        expect(body.includes.casts[0].id).toEqual(contentId);
      });

    await UsersRequest.recast(userC.castcleId)
      .auth(userC.accessToken, { type: 'bearer' })
      .send(request)
      .expect(async ({ body }) => {
        expect(body.payload).toBeDefined();
        expect(body.includes.casts[0].id).toEqual(contentId);
      });
  });

  it('STEP 2: Recast should get all user quotecast content successful', async () => {
    await ContentsRequest.recastsUser(contentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(3);
        expect(body.payload.find((x) => x.id === userA.id)).toBeDefined;
        expect(body.payload.find((x) => x.id === userB.id)).toBeDefined;
        expect(body.payload.find((x) => x.id === userC.id)).toBeDefined;
      });
  });

  it('STEP 3: UndoRecast should undo recast user successful', async () => {
    await UsersRequest.undoRecast(userA.castcleId, contentId).auth(
      userA.accessToken,
      { type: 'bearer' },
    );

    await ContentsRequest.recastsUser(contentId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(2);
        expect(body.payload.find((x) => x.id === userA.id)).toBeUndefined();
        expect(body.payload.find((x) => x.id === userB.id)).toBeDefined();
        expect(body.payload.find((x) => x.id === userC.id)).toBeDefined();
      });
  });
};
