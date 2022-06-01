import { ShortPayload } from '@castcle-api/database';
import { User } from '../../models';
import { ContentsRequest, UsersRequest } from '../../requests';
import { registerMockUser } from '../../utils/user.utils';
import { userGamma } from '../../variables/global.variable';

export const testQuoteCastsFlow = () => {
  let userA = new User({ name: 'quoteCastA' });
  let userB = new User({ name: 'quoteCastB' });
  let userC = new User({ name: 'quoteCastC' });
  let contentId;
  let quoteCastId;
  let quoteCastId2;
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

  it('STEP 1: Quotecast should quote cast content successful', async () => {
    const request = {
      contentId: contentId,
      message: 'Hello quote cast',
    };

    await UsersRequest.quotecasts(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(request)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual(request.message);
        expect(body.includes.casts[0].id).toEqual(contentId);
        quoteCastId = body.payload.id;
      });

    const request2 = {
      contentId: quoteCastId,
      message: 'Hello quote cast 2',
    };

    await UsersRequest.quotecasts(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(request2)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual(request2.message);
        expect(body.includes.casts[0].id).toEqual(contentId);
        quoteCastId2 = body.payload.id;
      });

    const request3 = {
      contentId: quoteCastId2,
      message: 'Hello quote cast 3',
    };

    await UsersRequest.quotecasts(userC.castcleId)
      .auth(userC.accessToken, { type: 'bearer' })
      .send(request3)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual(request3.message);
        expect(body.includes.casts[0].id).toEqual(contentId);
      });
  });

  it('STEP 2: Quotecast should get quote cast successful', async () => {
    await ContentsRequest.quotecastsUser(contentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(3);
        expect(body.includes.users.length).toEqual(4);
      });
  });

  it('STEP 3: LikeQuotecast should like quote content successful', async () => {
    const requst = {
      contentId: quoteCastId,
    };
    await UsersRequest.likeCasts(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst);

    await ContentsRequest.getContent(quoteCastId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.participate.liked).toEqual(true);
      });
  });

  it('STEP 4: CommentQuotecast should comment quote content successful', async () => {
    const requst = {
      message: 'good content',
      contentId: quoteCastId,
    };
    await UsersRequest.comment(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('good content');
        expect(body.payload).toBeDefined();
      });
  });

  it('STEP 5: UpdateQuotecast should update quote content successful', async () => {
    const updateContentPayload = {
      message: 'good content update',
    } as ShortPayload;
    const requst = {
      payload: updateContentPayload,
      type: 'short',
      castcleId: userA.castcleId,
    };

    await ContentsRequest.updateContent(quoteCastId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload.message).toEqual('good content update');
        expect(body.payload).toBeDefined();
      });

    await ContentsRequest.getContent(quoteCastId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload.message).toEqual('good content update');
        expect(body.payload).toBeDefined();
      });
  });
};
