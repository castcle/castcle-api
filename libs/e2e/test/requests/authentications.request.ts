import * as request from 'supertest';
import { authenticationsApp } from '../variables';

export class AuthenticationsRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    'API-Metadata': 'ip=127.0.0.1,src=CastcleOS,dest=castcle',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(authenticationsApp.getHttpServer())
      [method](url)
      .set(AuthenticationsRequest.headers);

  static delete = (url: string) =>
    AuthenticationsRequest.request('delete', url);
  static get = (url: string) => AuthenticationsRequest.request('get', url);
  static patch = (url: string) => AuthenticationsRequest.request('patch', url);
  static post = (url: string) => AuthenticationsRequest.request('post', url);
  static put = (url: string) => AuthenticationsRequest.request('put', url);

  static checkHealth = () => AuthenticationsRequest.get(`/`);
  static guestLogin = () => AuthenticationsRequest.post(`/guestLogin`);
  static register = () => AuthenticationsRequest.post(`/register`);
}
