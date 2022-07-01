import * as request from 'supertest';
import { apps } from '../variables';

export class AuthenticationsRequest {
  static headers = {
    'Accept-Language': 'en',
    'Accept-Version': '1.0',
    Device: 'CastclePhone',
    Platform: 'CastcleOS',
  };

  static request = (method: string, url: string): request.Test =>
    request(apps.authentications.getHttpServer())
      [method](url)
      .set(AuthenticationsRequest.headers);

  static delete = (url: string) =>
    AuthenticationsRequest.request('delete', url);
  static get = (url: string) => AuthenticationsRequest.request('get', url);
  static patch = (url: string) => AuthenticationsRequest.request('patch', url);
  static post = (url: string) => AuthenticationsRequest.request('post', url);
  static put = (url: string) => AuthenticationsRequest.request('put', url);

  static checkHealth = () => AuthenticationsRequest.get(`/authentications`);
  static guestLogin = () =>
    AuthenticationsRequest.post(`/authentications/guestLogin`);
  static register = () =>
    AuthenticationsRequest.post(`/authentications/register`);
  static memberLogin = () =>
    AuthenticationsRequest.post(`/authentications/login`);
  static verificationEmail = () =>
    AuthenticationsRequest.post(`/authentications/verificationEmail`);
  static refreshToken = () =>
    AuthenticationsRequest.post(`/authentications/refreshToken`);
  static verificationPassword = () =>
    AuthenticationsRequest.post(`/authentications/verificationPassword`);
  static changePasswordSubmit = () =>
    AuthenticationsRequest.post(`/authentications/changePasswordSubmit`);
  static registerToken = () =>
    AuthenticationsRequest.post(`/authentications/register-token`);
  static unregisterToken = () =>
    AuthenticationsRequest.delete(`/authentications/register-token`);
  static loginWithSocial = () =>
    AuthenticationsRequest.post(`/authentications/login-with-social`);
  static connectWithSocial = () =>
    AuthenticationsRequest.post(`/authentications/connect-with-social`);

  static suggestCastcleId = () =>
    AuthenticationsRequest.post(`/v2/authentications/suggest/castcle-id`);
}
