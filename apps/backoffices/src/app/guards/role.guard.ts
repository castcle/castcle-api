import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { RoleUser } from '../dtos/user.dto';
import { Account } from '../schemas/account.schema';
import { getTokenFromRequest } from '../utils/interceptors';
import { Token } from '../utils/token';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const roles = this.reflector.get<RoleUser[]>('roles', context.getHandler());
    if (roles && roles.length > 0) {
      const account = Token.decodeToken<Account>(getTokenFromRequest(request));
      if (roles.includes(account.role as RoleUser)) {
        return true;
      }
    }
    return false;
  }
}

export const Roles = (roles: RoleUser[]) => SetMetadata('roles', roles);
