import { Environment } from '@castcle-api/environments';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleRegExp, Password, Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessTokenPayload } from '../dtos/token.dto';
import {
  AccountDto,
  RoleUser,
  StaffSearchDto,
  StatusUser,
} from '../dtos/user.dto';
import { Account, AccountDocument } from '../schemas/account.schema';
import { SessionDocument } from '../schemas/session.schema';
import { generatePassword } from '../utils/password';

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Staff') public staffModel: Model<AccountDocument>,
    @InjectModel('StaffSession') public sessionModel: Model<SessionDocument>,
    private mailService: Mailer,
  ) {}

  async getAccountFromEmail(email: string, password: string) {
    const findStaff = await this.staffModel
      .findOne({
        email: CastcleRegExp.fromString(email),
        status: StatusUser.ACTIVE,
      })
      .exec();
    if (findStaff) {
      if (Password.verify(password, findStaff.password)) {
        await this.deleteSession(findStaff._id);
        const session = await this.createSession(findStaff);
        const accessToken = this.generateAccessToken({
          id: findStaff._id,
          email: findStaff.email,
          firstName: findStaff.firstName,
          lastName: findStaff.lastName,
          session: session._id,
        });
        return accessToken;
      }
    }
    throw CastcleException.INVALID_EMAIL_OR_PASSWORD;
  }

  async createAccountFromEmail(accountBody: AccountDto) {
    accountBody.password = generatePassword();

    const account = await new this.staffModel({
      email: accountBody.email,
      password: Password.create(accountBody.password),
      firstName: accountBody.firstName,
      lastName: accountBody.lastName,
      role: RoleUser.ADMINISTRATOR,
      status: StatusUser.ACTIVE,
    });

    await account.save().catch(() => {
      throw CastcleException.EMAIL_OR_PHONE_IS_EXIST;
    });

    await this.mailService.sendPasswordToStaff(account.email, account.password);

    return { email: accountBody.email, password: accountBody.password };
  }

  async getStaffList({ firstName, lastName, email }: StaffSearchDto) {
    const state = [];
    let query = [];
    if (firstName || lastName || email) {
      if (firstName) {
        state.push({
          firstName: { $regex: firstName, $options: 'i' },
        });
      }
      if (lastName) {
        state.push({
          lastName: { $regex: lastName, $options: 'i' },
        });
      }
      if (email) {
        state.push({
          email: { $regex: lastName, $options: 'i' },
        });
      }
    }

    if (state.length) {
      query = [...query, { $match: { $and: state } }];
    }

    query = [
      ...query,
      {
        $project: {
          email: '$email',
          firstName: '$firstName',
          lastName: '$lastName',
          role: '$role',
          regDate: '$createdAt',
        },
      },
    ];
    return await this.staffModel.aggregate(query);
  }

  generateAccessToken(payload: AccessTokenPayload) {
    const now = new Date();
    const accessTokenExpireDate = new Date(
      now.getTime() +
        Number(Environment.BACKOFFICE_JWT_ACCESS_EXPIRES_IN) * 1000,
    );
    payload.accessTokenExpiresTime = accessTokenExpireDate.toISOString();
    const accessToken = Token.generateToken(
      payload,
      Environment.BACKOFFICE_JWT_ACCESS_SECRET,
      Number(Environment.BACKOFFICE_JWT_ACCESS_EXPIRES_IN),
    );

    return { accessToken };
  }

  accessTokenValid(token: string) {
    return Token.isTokenValid(token, Environment.BACKOFFICE_JWT_ACCESS_SECRET);
  }

  accessTokenExpired(token: string) {
    return Token.isTokenExpire(token, Environment.BACKOFFICE_JWT_ACCESS_SECRET);
  }

  async decodeTokenValid(user: Account) {
    if (await this.staffModel.findOne({ email: user.email }).exec()) {
      return true;
    }
    return false;
  }

  async createSession(data: any) {
    const session = await new this.sessionModel({
      uid: String(data._id),
    });
    return session.save();
  }

  async deleteSession(uid: string) {
    return await this.sessionModel.deleteMany({ uid });
  }

  async deleteSessionOne(id: string) {
    return await this.sessionModel.deleteOne({
      _id: Types.ObjectId(id),
    });
  }

  async resetPassword(id: string) {
    const newPassword = generatePassword();

    const reset = await this.staffModel.findOne({ _id: Types.ObjectId(id) });

    Object.assign(reset, { password: Password.create(newPassword) });

    await reset.save();

    if (reset) {
      await this.deleteSession(id);
      await this.mailService.sendPasswordToStaff(reset.email, newPassword);
      return { password: newPassword };
    }

    throw CastcleException.INTERNAL_SERVER_ERROR;
  }

  async updateAccount(body: AccountDto) {
    return await this.staffModel.updateOne(
      { _id: Types.ObjectId(body.uid) },
      {
        firstName: body.firstName,
        lastName: body.lastName,
      },
    );
  }

  async checkSession(body: any) {
    return await this.sessionModel
      .findOne({ _id: Types.ObjectId(body.session) })
      .exec();
  }
}
