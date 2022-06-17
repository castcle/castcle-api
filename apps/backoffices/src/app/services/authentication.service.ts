import { Environment } from '@castcle-api/environments';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessTokenPayload } from '../dtos/token.dto';
import { AccountDto, StaffSearchDto } from '../dtos/user.dto';
import { AccountDocument } from '../schemas/account.schema';
import { SessionDocument } from '../schemas/session.schema';
import { Password } from '../utils/password';
import { CastcleRegExp } from '../utils/regex';
import { Token } from '../utils/token';
import { generatePassword, validateEmail } from '../utils/validate';

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Staff') public staffModel: Model<AccountDocument>,
    @InjectModel('StaffSession') public sessionModel: Model<SessionDocument>,
  ) {}

  async getAccountFromEmail(email: string, password: string) {
    const findStaff: any = await this.staffModel
      .findOne({
        email: CastcleRegExp.fromString(email),
      })
      .exec();
    if (findStaff) {
      if (await this.checkPasswordMatch(password, findStaff.password)) {
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

  async createAccountFromEmail(body: AccountDto) {
    const validEmail = await validateEmail(body.email);
    if (!validEmail) throw CastcleException.INVALID_EMAIL;

    body.password = generatePassword();

    const account = await new this.staffModel({
      email: body.email,
      password: await Password.generate(body.password),
      firstName: body.firstName,
      lastName: body.lastName,
      role: 'administrator',
      status: '1',
    });

    await account.save().catch(() => {
      throw CastcleException.EMAIL_OR_PHONE_IS_EXIST;
    });

    return { email: body.email, password: body.password };
  }

  async checkPasswordMatch(password: string, encrypt: string) {
    return Password.verify(password, encrypt);
  }

  async getStaffList({ firstName, lastName, email }: StaffSearchDto) {
    const state: any = [];
    let query: any = [];
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
      now.getTime() + Number(Environment.JWT_ACCESS_EXPIRES_IN) * 1000,
    );
    payload.accessTokenExpiresTime = accessTokenExpireDate.toISOString();
    const accessToken = Token.generateToken(
      payload,
      Environment.JWT_ACCESS_SECRET,
      Number(Environment.JWT_ACCESS_EXPIRES_IN),
    );
    return {
      accessToken,
      accessTokenExpireDate,
    };
  }

  accessTokenValid(token: string) {
    return Token.isTokenValid(token, Environment.JWT_ACCESS_SECRET);
  }

  accessTokenExpired(token: string) {
    return Token.isTokenExpire(token, Environment.JWT_ACCESS_SECRET);
  }

  async decodeTokenValid(user: any) {
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

    const reset = await this.staffModel.updateOne(
      { _id: Types.ObjectId(id) },
      { password: await Password.generate(newPassword) },
    );

    if (reset) {
      await this.deleteSession(id);
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
