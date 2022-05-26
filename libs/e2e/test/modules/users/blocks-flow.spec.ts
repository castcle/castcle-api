import { ShortPayload } from '../../../../database/src/lib/dtos/content.dto';
import { User } from '../../models';
import { CommentRequest, ContentsRequest, UsersRequest } from '../../requests';
import { registerMockUser } from '../../utils/user.utils';

export const testBlocksFlow = () => {
  let userA = new User({ name: 'blockA' });
  let userB = new User({ name: 'blockB' });
  let userC = new User({ name: 'blockC' });
  let contentId;
  let commentId;
  beforeAll(async () => {
    userA = await registerMockUser(userA);
    userB = await registerMockUser(userB);
    userC = await registerMockUser(userC);

    const shortPayload = {
      message: 'Hi Castcle test block',
    } as ShortPayload;

    const requst = {
      payload: shortPayload,
      type: 'short',
      castcleId: userA.castcleId,
    };
    await ContentsRequest.createContent()
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.id).toBeDefined();
        expect(body.payload.type).toEqual('short');
        expect(body.payload).toBeDefined();
        contentId = body.payload.id;
      });

    const requstComment = {
      message: 'hello',
      contentId: contentId,
    };
    await UsersRequest.comment(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requstComment)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello');
        expect(body.payload).toBeDefined();
        commentId = body.payload.id;
      });

    const requstReply = {
      message: 'hello reply',
    };
    await UsersRequest.replyComment(userC.castcleId, commentId)
      .auth(userC.accessToken, { type: 'bearer' })
      .send(requstReply)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello reply');
        expect(body.payload).toBeDefined();
      });
  });

  it('STEP 1: BlockUser should block user successful', async () => {
    const requst = {
      targetCastcleId: userB.castcleId,
    };
    await UsersRequest.blockUser(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst);

    await UsersRequest.getBlockUser(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].castcleId).toEqual(userB.castcleId);
      });
  });

  it('STEP 2: GetBlockUser should get block user successful', async () => {
    await UsersRequest.getBlockUser(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].castcleId).toEqual(userB.castcleId);
      });
  });

  it('STEP 3: BlockUser Get Content should get content with block relation successful', async () => {
    await ContentsRequest.getContent(contentId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.includes.users[0].blocked).toEqual(true);
      });
  });

  it('STEP 4: Unblock User should unblock user successful', async () => {
    const requst = {
      targetCastcleId: userB.castcleId,
    };
    await UsersRequest.unBlockUser(userA.castcleId, userB.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst);

    await UsersRequest.getBlockUser(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.meta.resultCount).toEqual(0);
      });
  });

  it('STEP 5: BlockUser Reply should block user successful', async () => {
    const requst = {
      targetCastcleId: userC.castcleId,
    };
    await UsersRequest.blockUser(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst);

    await UsersRequest.getBlockUser(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].castcleId).toEqual(userC.castcleId);
      });
  });

  it('STEP 6: GetBlockUser Reply should get block reply user successful', async () => {
    await UsersRequest.getBlockUser(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].castcleId).toEqual(userC.castcleId);
      });
  });

  it('STEP 7: BlockUser Get Comment should get comment with block relation successful', async () => {
    await CommentRequest.getCommentFromContent(contentId)
      .auth(userC.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(
          body.includes.users.find((x) => x.castcleId === userB.castcleId)
            .blocked,
        ).toEqual(true);
      });
  });

  it('STEP 8: Unblock Reply User should unblock reply user successful', async () => {
    const requst = {
      targetCastcleId: userB.castcleId,
    };
    await UsersRequest.unBlockUser(userB.castcleId, userC.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst);

    await UsersRequest.getBlockUser(userB.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.meta.resultCount).toEqual(0);
      });
  });
};
