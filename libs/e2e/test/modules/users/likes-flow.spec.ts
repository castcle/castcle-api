import * as mongoose from 'mongoose';
import { ShortPayload } from '../../../../database/src/lib/dtos/content.dto';
import { User } from '../../models';
import { CommentRequest, ContentsRequest, UsersRequest } from '../../requests';
import { registerMockUser } from '../../utils/user.utils';
import {
  commentModel,
  contentModel,
  userAlpha,
  userBeta,
  userGamma,
} from '../../variables';

export const testLikesFlow = () => {
  let userA = new User({ name: 'likeA' });
  let userB = new User({ name: 'likeB' });
  let userC = new User({ name: 'likeC' });
  let contentId;
  let commentId;
  let replyCommentId;
  beforeAll(async () => {
    userA = await registerMockUser(userA);
    userB = await registerMockUser(userB);
    userC = await registerMockUser(userC);

    const shortPayload = {
      message: 'Hi Castcle test like',
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
    await UsersRequest.comment(userAlpha.castcleId)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send(requstComment)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello');
        expect(body.payload).toBeDefined();
        commentId = body.payload.id;
      });

    const requstReply = {
      message: 'hello reply',
    };
    await UsersRequest.replyComment(userBeta.castcleId, commentId)
      .auth(userBeta.accessToken, { type: 'bearer' })
      .send(requstReply)
      .expect(async ({ body }) => {
        expect(body.payload.message).toEqual('hello reply');
        expect(body.payload).toBeDefined();
        replyCommentId = body.payload.id;
      });
  });

  it('STEP 1: LikeContent should like content successful', async () => {
    const requst = {
      contentId: contentId,
    };
    await UsersRequest.likeCasts(userA.castcleId)
      .auth(userA.accessToken, { type: 'bearer' })
      .send(requst);

    await ContentsRequest.getContent(contentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload.participate.liked).toEqual(true);
      });
  });

  it('STEP 2: LikeComment should like comment successful', async () => {
    const requst = {
      commentId: commentId,
    };
    await UsersRequest.likeComment(userB.castcleId)
      .auth(userB.accessToken, { type: 'bearer' })
      .send(requst);

    await CommentRequest.getCommentFromContent(contentId)
      .auth(userB.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload[0].participate.liked).toEqual(true);
      });
  });

  it('STEP 3: LikeReplyComment should like reply comment successful', async () => {
    const requst = {
      commentId: replyCommentId,
    };
    await UsersRequest.likeComment(userC.castcleId)
      .auth(userC.accessToken, { type: 'bearer' })
      .send(requst);

    await CommentRequest.getReplyComment(contentId, commentId)
      .auth(userC.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.payload[0].participate.liked).toEqual(true);
      });
  });

  it('STEP 4: LikingUser should get liking user successful', async () => {
    await ContentsRequest.likingUser(contentId)
      .auth(userA.accessToken, { type: 'bearer' })
      .expect(async ({ body }) => {
        expect(body.meta.resultCount).toEqual(1);
        expect(body.payload[0].castcleId).toEqual(userA.castcleId);
      });
  });

  it('STEP 5: UnLike Content should unlike content successful', async () => {
    await UsersRequest.unlikeCasts(userA.castcleId, contentId).auth(
      userA.accessToken,
      { type: 'bearer' },
    );

    const content = await contentModel
      .findOne({ _id: mongoose.Types.ObjectId(contentId) })
      .exec();
    expect(content.engagements.like.count).toEqual(0);
  });

  it('STEP 6: UnLike Comment should unlike comment successful', async () => {
    await UsersRequest.unlikeComment(userB.castcleId, commentId).auth(
      userB.accessToken,
      { type: 'bearer' },
    );

    const comment = await commentModel
      .findOne({ _id: mongoose.Types.ObjectId(commentId) })
      .exec();
    expect(comment.engagements.like.count).toEqual(0);
    expect(comment.type).toEqual('comment');
  });

  it('STEP 7: UnLike ReplyComment should unlike reply comment successful', async () => {
    await UsersRequest.unlikeComment(userC.castcleId, replyCommentId).auth(
      userC.accessToken,
      { type: 'bearer' },
    );

    const replyComment = await commentModel
      .findOne({ _id: mongoose.Types.ObjectId(replyCommentId) })
      .exec();
    expect(replyComment.engagements.like.count).toEqual(0);
    expect(replyComment.type).toEqual('reply');
  });
};
