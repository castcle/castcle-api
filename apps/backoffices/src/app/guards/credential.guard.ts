import { Environment } from '@castcle-api/environments';
import { Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  getLanguageFromRequest,
  getTokenFromRequest,
} from '@castcle-api/utils/interceptors';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { StaffDto } from '../models/authentication.dto';
import { AuthenticationService } from '../services/authentication.service';

@Injectable()
export class CredentialGuard implements CanActivate {
  constructor(private authService: AuthenticationService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.$language = getLanguageFromRequest(request);
    request.$token = getTokenFromRequest(request);

    request.$credential = Token.isTokenValid(
      request.$token,
      Environment.BACKOFFICE_JWT_ACCESS_SECRET,
    );

    request.$payload = Token.decodeToken<StaffDto>(request.$token);

    if (!request.$credential || !request.$payload)
      throw new CastcleException('INVALID_ACCESS_TOKEN');

    const isAccessTokenExist = await this.authService.findByAccessToken(
      request.$token,
    );

    if (!isAccessTokenExist) throw new CastcleException('INVALID_ACCESS_TOKEN');

    return true;
  }
}
