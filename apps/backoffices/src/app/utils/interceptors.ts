import { Environment } from '@castcle-api/environments';
import { CastcleException } from '@castcle-api/utils/exception';
import { HeadersRequest } from '@castcle-api/utils/interceptors';
import { Request } from 'express';

export const getTokenFromRequest = (request: HeadersRequest) => {
  if (request.headers && request.headers.authorization) {
    const token = request.headers.authorization.split(' ')[1];
    if (token) return token;
  }
  throw CastcleException.MISSING_AUTHORIZATION_HEADERS;
};

export const getLanguageFromRequest = (request: Request) => {
  if (request.headers && request.headers['accept-language']) {
    return request.headers['accept-language'];
  }
  throw CastcleException.MISSING_AUTHORIZATION_HEADERS;
};

export const getApikeyFromRequest = (request: Request) => {
  if (request.headers && request.headers['api-key']) {
    if (request.headers['api-key'] === Environment.BACKOFFICE_API_KEY)
      return request.headers['api-key'];
  }
  throw CastcleException.MISSING_AUTHORIZATION_HEADERS;
};

export const getIpFromRequest = (request: Request) => {
  //API-Metadata: "ip=127.0.0.1,src=iOS,dest=castcle-authentications"
  if (request.headers && request.headers['api-metadata']) {
    const regexResult = (request.headers['api-metadata'] as string).match(
      /ip=(\d+\.\d+\.\d+\.\d+),src=(\w+),dest=(.+)/,
    );
    if (regexResult) {
      return regexResult[1];
    }
  }
  throw CastcleException.INVALID_FORMAT;
};
