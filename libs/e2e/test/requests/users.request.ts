import * as request from 'supertest';
import { usersApp } from '../variables';

export class UsersRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    'API-Metadata': 'ip=127.0.0.1,src=CastcleOS,dest=castcle',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(usersApp.getHttpServer())[method](url).set(UsersRequest.headers);

  static delete = (url: string) => UsersRequest.request('delete', url);
  static get = (url: string) => UsersRequest.request('get', url);
  static patch = (url: string) => UsersRequest.request('patch', url);
  static post = (url: string) => UsersRequest.request('post', url);
  static put = (url: string) => UsersRequest.request('put', url);

  static checkHealth = () => UsersRequest.get('/healthy');
  static report = (userId: string) => UsersRequest.post(`/${userId}/reporting`);
}
