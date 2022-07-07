import { Environment } from '@castcle-api/environments';
import * as request from 'supertest';
import { apps } from '../variables';

export class BackofficesRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    'api-key': Environment.BACKOFFICE_API_KEY,
  };

  static request = (method: string, url: string): request.Test =>
    request(apps.backoffices.getHttpServer())
      [method](url)
      .set(BackofficesRequest.headers);

  static delete = (url: string) => BackofficesRequest.request('delete', url);
  static get = (url: string) => BackofficesRequest.request('get', url);
  static patch = (url: string) => BackofficesRequest.request('patch', url);
  static post = (url: string) => BackofficesRequest.request('post', url);
  static put = (url: string) => BackofficesRequest.request('put', url);

  static login = () => BackofficesRequest.post(`/v2/backoffices/login/email`);
  static logout = () => BackofficesRequest.post(`/v2/backoffices/logout`);
  static createStaff = () => BackofficesRequest.post(`/v2/backoffices/staff`);
  static getStaffs = () => BackofficesRequest.get(`/v2/backoffices/staff`);
  static deleteStaff = (staffId: string) =>
    BackofficesRequest.delete(`/v2/backoffices/staff/${staffId}`);
  static resetPassword = (staffId: string) =>
    BackofficesRequest.post(`/v2/backoffices/staff/${staffId}/reset/password`);
  static createCampaign = () =>
    BackofficesRequest.post(`/v2/backoffices/campaigns`);
  static getCampaigns = () =>
    BackofficesRequest.get(`/v2/backoffices/campaigns`);
  static updateCampaign = (campaignId: string) =>
    BackofficesRequest.put(`/v2/backoffices/campaigns/${campaignId}`);
}
