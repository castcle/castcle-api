import { ShortPayload } from '../../../../database/src/lib/dtos/content.dto';
import { User } from '../../models';
import { AuthenticationsRequest, ContentsRequest } from '../../requests';
import { CommentRequest } from '../../requests/comment.request';
import { UsersRequest } from '../../requests/users.request';
import { userGamma } from '../../variables';

export const testCommentsFlow = () => {
  const userA = new User({ name: 'CommentA' });
  let contentId;
  let commentId;
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
  });

  it('STEP 1: CreateComment should create comment successful', async () => {
    const requst = {
      message: 'hello',
      contentId: contentId,
    };
    await UsersRequest.comment(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello');
        expect(body.payload).toBeDefined();
      });
  });

  it('STEP 2: GetComment should get comment with others user successful', async () => {
    await CommentRequest.getCommentFromContent(contentId)
      .auth(userGamma.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.length).toEqual(1);
        expect(body.payload[0].message).toEqual('hello');
        commentId = body.payload[0].id;
      });
  });

  it('STEP 3: UpdateComment should update comment successful', async () => {
    const requst = { message: 'hello update!' };

    await UsersRequest.updateComment(userA.castcleId, commentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello update!');
        expect(body.payload).toBeDefined();
      });
  });

  it('STEP 4: DeleteComment should delete comment successful', async () => {
    await UsersRequest.deleteComment(userA.castcleId, commentId).auth(
      userA.accessToken,
      {
        type: 'bearer',
      },
    );

    await CommentRequest.getCommentFromContent(contentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.meta.resultCount).toEqual(0);
      });
  });
};
