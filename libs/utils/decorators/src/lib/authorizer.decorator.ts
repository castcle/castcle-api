import { UserDocument } from '@castcle-api/database/schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class Authorizer {
  constructor(public user: UserDocument) {}

  /**
   * permit if target user ID is `me` (case-insensitive) or same as user ID
   * @param {string} targetUserId Target user ID to access
   */
  requestAccessForUser(targetUserId: string) {
    const isMe = targetUserId.toLowerCase() === 'me';
    const isSameId = this.user.id === targetUserId;

    if (isMe || isSameId) return;

    throw CastcleException.FORBIDDEN;
  }
}

export const Auth = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = await request.$user;

    return new Authorizer(user);
  }
);
