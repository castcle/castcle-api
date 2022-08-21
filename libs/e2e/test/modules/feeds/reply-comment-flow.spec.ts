import { ShortPayload } from '../../../../database/src/lib/dtos/content.dto';
import { User } from '../../models';
import {
  AuthenticationsRequest,
  CommentRequest,
  ContentsRequest,
} from '../../requests';
import { UsersRequest } from '../../requests/users.request';
import { userGamma } from '../../variables';

export const testReplyCommentsFlow = () => {
  const userA = new User({ name: 'CommentRepA' });
  const userB = new User({ name: 'ReplyA' });
  let contentId;
  let commentId;
  let replyCommentId;
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

    await AuthenticationsRequest.guestLogin()
      .send({ deviceUUID: userB.deviceUUID })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();

        userB.guestToken = body.accessToken;
      });

    await AuthenticationsRequest.register()
      .auth(userB.guestToken, { type: 'bearer' })
      .send(userB.toRegisterPayload())
      .expect(async ({ body }) => {
        expect(body.message).toBeUndefined();
        expect(body.accessToken).toBeDefined();
        expect(body.profile.id).toBeDefined();
        expect(body.profile.castcleId).toEqual(userB.castcleId);
        expect(body.profile.displayName).toEqual(userB.displayName);
        expect(body.profile.email).toEqual(userB.email);

        userB.accessToken = body.accessToken;
        userB.id = body.profile.id;
      });

    const shortPayload = {
      message: 'Hi Castcle test comment',
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

    const requstComment = {
      message: 'hello',
      contentId: contentId,
    };
    await UsersRequest.comment(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requstComment)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello');
        expect(body.payload).toBeDefined();
        commentId = body.payload.id;
      });
  });

  it('STEP 1: ReplyComment should reply comment successful', async () => {
    const requst = {
      message: 'hello reply',
    };
    await UsersRequest.replyComment(userB.castcleId, commentId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello reply');
        expect(body.payload).toBeDefined();
        replyCommentId = body.payload.id;
      });
  });

  it('STEP 2: GetReplyComment should get reply comment with others user successful', async () => {
    await CommentRequest.getReplyComment(contentId, commentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].id).toEqual(replyCommentId);
        expect(body.payload[0].message).toEqual('hello reply');
      });
  });

  it('STEP 3: UpdateReplyComment should update reply commnet successful', async () => {
    const requst = { message: 'hello reply update!' };

    await UsersRequest.updateReplyComment(
      userB.castcleId,
      commentId,
      replyCommentId,
    )
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello reply update!');
        expect(body.payload).toBeDefined();
      });
  });

  it('STEP 4: DeleteReplyComment should delete reply comment successful', async () => {
    await UsersRequest.deleteReplyComment(
      userB.castcleId,
      commentId,
      replyCommentId,
    ).auth(userB.accessToken, {
      type: 'bearer',
    });

    await CommentRequest.getReplyComment(contentId, commentId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.meta.resultCount).toEqual(0);
      });
  });
};
