import { Account, Credential, User } from '@castcle-api/database/schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class Authorizer {
  constructor(
    public account: Account,
    public user: User,
    public credential: Credential
  ) {}

  /**
   * permit if `accountId` to access is same as ID of authenticated account
   * @param {string | ObjectId} accountId account ID to access
   */
  requestAccessForAccount(accountId: any) {
    if (this.account.id === String(accountId)) return;

    throw CastcleException.FORBIDDEN;
  }

  /**
   * permit if `userId` to access is `me` (case-insensitive) or same as ID of authenticated user
   * @param {string} userId user ID to access
   */
  requestAccessForUser(userId: string) {
    const isMe = userId.toLowerCase() === 'me';
    const isSameId = this.user.id === userId;
    const isSameCastcleId = this.user.displayId === userId;

    if (isMe || isSameId || isSameCastcleId) return;

    throw CastcleException.FORBIDDEN;
  }
}

export const Auth = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const account = request.$credential.account;
    const user = await request.$user;
    const credential = request.$credential;
    return new Authorizer(account, user, credential);
  }
);
