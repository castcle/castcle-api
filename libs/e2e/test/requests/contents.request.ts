import * as request from 'supertest';
import { apps } from '../variables';

export class ContentsRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(apps.feeds.getHttpServer())
      [method](url)
      .set(ContentsRequest.headers);

  static delete = (url: string) => ContentsRequest.request('delete', url);
  static get = (url: string) => ContentsRequest.request('get', url);
  static patch = (url: string) => ContentsRequest.request('patch', url);
  static post = (url: string) => ContentsRequest.request('post', url);
  static put = (url: string) => ContentsRequest.request('put', url);

  static checkHealth = () => ContentsRequest.get('/contents/healthy');
  static createContent = () => ContentsRequest.post('/contents/feed');
  static getContent = (contentId: string) =>
    ContentsRequest.get(
      `/v2/contents/${contentId}?userFields=relationships&hasRelationshipExpansion=true`,
    );
  static updateContent = (contentId: string) =>
    ContentsRequest.put(`/contents/${contentId}`);
  static deleteContent = (contentId: string) =>
    ContentsRequest.delete(`/contents/${contentId}`);
  static likingUser = (contentId: string) =>
    ContentsRequest.get(`/v2/contents/${contentId}/liking-users`);
  static quotecastsUser = (contentId: string) =>
    ContentsRequest.get(`/v2/contents/${contentId}/quotecasts`);
  static recastsUser = (contentId: string) =>
    ContentsRequest.get(`/v2/contents/${contentId}/recasts`);
}
