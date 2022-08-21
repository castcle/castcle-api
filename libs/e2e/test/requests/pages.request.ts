import * as request from 'supertest';
import { apps } from '../variables';

export class PageRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(apps.pages.getHttpServer())[method](url).set(PageRequest.headers);

  static delete = (url: string) => PageRequest.request('delete', url);
  static get = (url: string) => PageRequest.request('get', url);
  static patch = (url: string) => PageRequest.request('patch', url);
  static post = (url: string) => PageRequest.request('post', url);
  static put = (url: string) => PageRequest.request('put', url);

  static checkHealth = () => PageRequest.get('/users/healthy');
  static getPage = (id: string) => PageRequest.get(`/pages/${id}`);
  static deletePage = (id: string) => PageRequest.delete(`/pages/${id}`);
}
