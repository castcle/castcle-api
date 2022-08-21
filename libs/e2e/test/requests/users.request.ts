import * as request from 'supertest';
import { apps } from '../variables';

export class UsersRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  private static request = (method: string, url: string): request.Test =>
    request(apps.users.getHttpServer())[method](url).set(UsersRequest.headers);

  private static delete = (url: string) => UsersRequest.request('delete', url);
  private static get = (url: string) => UsersRequest.request('get', url);
  private static patch = (url: string) => UsersRequest.request('patch', url);
  private static post = (url: string) => UsersRequest.request('post', url);
  private static put = (url: string) => UsersRequest.request('put', url);

  static checkHealth = () => UsersRequest.get('/users/healthy');
  static deleteUser = () => UsersRequest.delete('/v2/users/me');
  static updateMobile = () => UsersRequest.put('/users/me/mobile');
  static report = (userId: string) =>
    UsersRequest.post(`/users/${userId}/reporting`);
  static createPage = () => UsersRequest.post('/users/me/pages');
  static getMyPages = () => UsersRequest.get('/users/me/pages');
  static syncSocial = () => UsersRequest.post('/users/me/pages/sync-social');
  static syncSocialLookup = () =>
    UsersRequest.get('/users/me/pages/sync-social');
  static setAutoPost = (socialId: string) =>
    UsersRequest.post(`/users/me/pages/sync-social/${socialId}/auto-post`);
  static cancelAutoPost = (socialId: string) =>
    UsersRequest.delete(`/users/me/pages/sync-social/${socialId}/auto-post`);
  static reconnectSocial = (socialId: string) =>
    UsersRequest.post(`/users/me/pages/sync-social/${socialId}/connect`);
  static disconnectSocial = (socialId: string) =>
    UsersRequest.delete(`/users/me/pages/sync-social/${socialId}/connect`);
  static followUser = (userId: string) =>
    UsersRequest.post(`/users/${userId}/following`);
  static getFollowing = (userId: string) =>
    UsersRequest.get(`/users/${userId}/following`);
  static getFollowers = (userId: string) =>
    UsersRequest.get(`/users/${userId}/followers`);
  static unfollow = (userId: string, targetCastcleId: string) =>
    UsersRequest.delete(`/users/${userId}/following/${targetCastcleId}`);
  static comment = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/comments`);
  static updateComment = (userId: string, sourceCommentId: string) =>
    UsersRequest.put(`/v2/users/${userId}/comments/${sourceCommentId}`);
  static deleteComment = (userId: string, sourceCommentId: string) =>
    UsersRequest.delete(`/v2/users/${userId}/comments/${sourceCommentId}`);
  static replyComment = (userId: string, sourceCommentId: string) =>
    UsersRequest.post(`/v2/users/${userId}/comments/${sourceCommentId}/reply`);
  static updateReplyComment = (
    userId: string,
    sourceCommentId: string,
    replyCommentId: string,
  ) =>
    UsersRequest.put(
      `/v2/users/${userId}/comments/${sourceCommentId}/reply/${replyCommentId}`,
    );
  static deleteReplyComment = (
    userId: string,
    sourceCommentId: string,
    replyCommentId: string,
  ) =>
    UsersRequest.delete(
      `/v2/users/${userId}/comments/${sourceCommentId}/reply/${replyCommentId}`,
    );
  static likeCasts = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/likes-casts`);
  static unlikeCasts = (userId: string, sourceContentId: string) =>
    UsersRequest.delete(`/v2/users/${userId}/likes-casts/${sourceContentId}`);
  static likeComment = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/likes-comments`);
  static unlikeComment = (userId: string, sourceCommentId: string) =>
    UsersRequest.delete(
      `/v2/users/${userId}/likes-comments/${sourceCommentId}`,
    );
  static quotecasts = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/quotecasts`);
  static recast = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/recasts`);
  static undoRecast = (userId: string, sourceCommentId: string) =>
    UsersRequest.delete(`/v2/users/${userId}/recasts/${sourceCommentId}`);
  static blockUser = (userId: string) =>
    UsersRequest.post(`/v2/users/${userId}/blocking`);
  static getBlockUser = (userId: string) =>
    UsersRequest.get(`/v2/users/${userId}/blocking`);
  static unBlockUser = (userId: string, targetCastcleId: string) =>
    UsersRequest.delete(`/v2/users/${userId}/blocking/${targetCastcleId}`);
}
