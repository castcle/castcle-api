import {
  HeadersInterceptor,
  HeadersRequest,
} from '@castcle-api/utils/interceptors';
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getTokenFromRequest } from '../utils/interceptors';

export interface TokenRequest extends HeadersRequest {
  $token: string;
}

@Injectable()
export class TokenInterceptor extends HeadersInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const HeaderInterceptResult = super.intercept(context, next);
    const request = context.switchToHttp().getRequest();
    request.$token = getTokenFromRequest(request);
    return HeaderInterceptResult;
  }
}
