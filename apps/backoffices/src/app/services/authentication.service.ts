import { Environment } from '@castcle-api/environments';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleRegExp, Password, Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AccessTokenPayload } from '../dtos/token.dto';
import { AccountDto, RoleUser, StatusUser } from '../dtos/user.dto';
import { AccountDocument } from '../schemas/account.schema';
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
    const staff = await this.findStaff({
      email: CastcleRegExp.fromString(email),
      status: StatusUser.ACTIVE,
    });
    if (staff) {
      if (Password.verify(password, staff.password)) {
        const token = this.generateAccessToken({
          id: staff._id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
          status: staff.status,
          role: staff.role,
        });
        staff.loginAt.push(new Date());
        staff.accessToken = token.accessToken;
        await staff.save();

        return token;
      }
    }
    throw CastcleException.INVALID_EMAIL_OR_PASSWORD;
  }

  async createAccountFromEmail(accountBody: AccountDto) {
    const password = generatePassword();
    const account = await new this.staffModel({
      email: accountBody.email,
      password: Password.create(password),
      firstName: accountBody.firstName,
      lastName: accountBody.lastName,
      role: RoleUser.ADMINISTRATOR,
      status: StatusUser.ACTIVE,
    });

    await account.save().catch(() => {
      throw CastcleException.EMAIL_OR_PHONE_IS_EXIST;
    });

    await this.mailService.sendPasswordToStaff(account.email, account.password);

    return { email: accountBody.email, password: password };
  }

  async getStaffs() {
    return this.staffModel.find().exec();
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

  accessTokenExpired(token: string) {
    return Token.isTokenExpire(token, Environment.BACKOFFICE_JWT_ACCESS_SECRET);
  }

  async findByAccessToken(accessToken: string) {
    return await this.findStaff({ accessToken });
  }

  async resetPassword(id: string) {
    try {
      const newPassword = generatePassword();
      const staff = await this.findStaff({ _id: Types.ObjectId(id) });
      if (staff) {
        Object.assign(staff, { password: Password.create(newPassword) });
        await staff.save();
        await this.mailService.sendPasswordToStaff(staff.email, newPassword);
        return { password: newPassword };
      }
      throw new CastcleException('STAFF_NOT_FOUND');
    } catch (error) {
      throw new CastcleException('STAFF_NOT_FOUND');
    }
  }

  async removeToken(staffId: string) {
    const findStaff = await this.findStaff({ _id: Types.ObjectId(staffId) });
    findStaff.set('accessToken', undefined);
    await findStaff.save();
  }

  findStaff(filter: FilterQuery<AccountDocument>) {
    return this.staffModel.findOne(filter).exec();
  }

  deleteStaff(staffId: string) {
    try {
      return this.staffModel.deleteOne({ _id: Types.ObjectId(staffId) }).exec();
    } catch (error) {
      throw new CastcleException('STAFF_NOT_FOUND');
    }
  }
}
