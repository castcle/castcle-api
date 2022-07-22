import {
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Token } from '@castcle-api/utils/commons';
import { getTokenFromRequest } from '@castcle-api/utils/interceptors';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, StaffRole } from '../models/authentication.enum';
import { Staff } from '../schemas/staff.schema';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const staff = Token.decodeToken<Staff>(getTokenFromRequest(request));
    const ability = this.createStaffAbility(staff);

    return requiredPermissions.every((permission) =>
      ability.can(permission, staff),
    );
  }

  createStaffAbility(staff: Staff) {
    const { can, build } = new AbilityBuilder<Ability<[Permission, Subjects]>>(
      Ability as AbilityClass<AppAbility>,
    );

    if (staff.role === StaffRole.ADMINISTRATOR) {
      can(Permission.Manage, 'all');
    } else {
      can(Permission.Read, Staff);
    }

    return build({
      detectSubjectType: (staff) =>
        staff.constructor as ExtractSubjectType<Subjects>,
    });
  }
}

type Subjects = InferSubjects<typeof Staff> | 'all';

type AppAbility = Ability<[Permission, Subjects]>;

export const RequiredPermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);
