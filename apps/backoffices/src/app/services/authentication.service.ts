import { Environment } from '@castcle-api/environments';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleRegExp, Password, Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { FilterQuery, Model, Types } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { AccessTokenPayload, StaffDto } from '../models/authentication.dto';
import { StaffStatus } from '../models/authentication.enum';
import { StaffDocument } from '../schemas/staff.schema';

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Staff') public staffModel: Model<StaffDocument>,
    private mailService: Mailer,
  ) {}

  async getStaffFromEmail(email: string, password: string) {
    const staff = await this.findStaff({
      email: CastcleRegExp.fromString(email),
      status: StaffStatus.ACTIVE,
    });

    if (!staff || !Password.verify(password, staff.password))
      throw new CastcleException('INVALID_EMAIL_OR_PASSWORD');

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

  async createStaffFromEmail(staffBody: StaffDto) {
    try {
      const password = this.generatePassword();

      const staff = await new this.staffModel({
        email: staffBody.email,
        password: password.hash,
        firstName: staffBody.firstName,
        lastName: staffBody.lastName,
        role: staffBody.role,
        status: StaffStatus.ACTIVE,
      }).save();

      await this.mailService.sendPasswordToStaff(staff.email, password.raw);
      return { email: staffBody.email, password: password.raw };
    } catch (error) {
      throw new CastcleException('EMAIL_OR_PHONE_IS_EXIST');
    }
  }

  private generatePassword() {
    const raw = customAlphabet(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    )(10);

    return { hash: Password.hash(raw), raw };
  }

  async getStaffs() {
    return this.staffModel
      .find()
      .select('firstName lastName email role status')
      .exec();
  }

  generateAccessToken(payload: AccessTokenPayload) {
    const accessTokenExpireDate = DateTime.now()
      .plus({
        milliseconds: Environment.BACKOFFICE_JWT_ACCESS_EXPIRES_IN,
      })
      .toJSDate();

    payload.accessTokenExpiresTime = accessTokenExpireDate.toISOString();

    const accessToken = Token.generateToken(
      payload,
      Environment.BACKOFFICE_JWT_ACCESS_SECRET,
      Number(Environment.BACKOFFICE_JWT_ACCESS_EXPIRES_IN),
    );

    return { accessToken };
  }

  async findByAccessToken(accessToken: string) {
    return await this.findStaff({ accessToken });
  }

  async resetPassword(id: string) {
    const password = this.generatePassword();
    const staff = await this.findStaff({ _id: Types.ObjectId(id) });
    if (!staff) throw new CastcleException('STAFF_NOT_FOUND');

    staff.password = password.hash;

    await staff.save();
    await this.removeToken(id);
    await this.mailService.sendPasswordToStaff(staff.email, password.raw);

    return { password: password.raw };
  }

  async removeToken(staffId: string) {
    const findStaff = await this.findStaff({ _id: Types.ObjectId(staffId) });
    await findStaff.set('accessToken', undefined).save();
  }

  findStaff(filter: FilterQuery<StaffDocument>) {
    return this.staffModel.findOne(filter).exec();
  }

  async deleteStaff(staffId: string) {
    const { deletedCount } = await this.staffModel
      .deleteOne({ _id: Types.ObjectId(staffId) })
      .exec();

    if (deletedCount === 0) throw new CastcleException('STAFF_NOT_FOUND');
  }
}
