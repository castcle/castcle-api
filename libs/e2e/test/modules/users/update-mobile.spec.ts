import { OtpObjective } from '@castcle-api/database';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'supertest';
import { User } from '../../models';
import { AuthenticationsRequest, UsersRequest } from '../../requests';
import { guest, otpModel, userAlpha, userModel } from '../../variables';

export const testUsersUpdateMobile = () => {
  const tempUser = new User({ name: 'temp', referrer: userAlpha.castcleId });
  let updateMobileResponse: Response;

  beforeAll(async () => {
    await AuthenticationsRequest.guestLogin()
      .send({ deviceUUID: tempUser.deviceUUID })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();

        tempUser.guestToken = body.accessToken;
      });

    await AuthenticationsRequest.register()
      .auth(tempUser.guestToken, { type: 'bearer' })
      .send(tempUser.toRegisterPayload())
      .expect(async ({ body }) => {
        expect(body.message).toBeUndefined();
        expect(body.accessToken).toBeDefined();
        expect(body.profile.id).toBeDefined();
        expect(body.profile.castcleId).toEqual(tempUser.castcleId);
        expect(body.profile.displayName).toEqual(tempUser.displayName);
        expect(body.profile.email).toEqual(tempUser.email);

        tempUser.accessToken = body.accessToken;
        tempUser.id = body.profile.id;
      });

    const user = await userModel.findByIdAndUpdate(tempUser.id, {
      'verified.mobile': true,
    });

    tempUser.accountId = user.ownerAccount as unknown as string;

    const otp = await new otpModel({
      account: tempUser.accountId,
      action: 'verify_mobile',
      refCode: 'ref-code',
      requestId: tempUser.accountId,
      retry: 0,
      isVerify: true,
      expireDate: new Date(new Date().getTime() + 10_000),
      receiver: tempUser.countryCode + tempUser.phone,
    }).save();

    updateMobileResponse = await UsersRequest.updateMobile()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({
        objective: 'verify_mobile',
        refCode: 'ref-code',
        countryCode: tempUser.countryCode,
        mobileNumber: tempUser.phone,
      });

    await otp.delete();
  });

  it('should return UNAUTHORIZED when sending request without credential', () => {
    return UsersRequest.updateMobile()
      .expect(({ body }) => {
        expect(body.message).toEqual('Missing Authorization header.');
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should return BAD_REQUEST when sending invalid request body', () => {
    return UsersRequest.updateMobile()
      .auth(guest.guestToken, { type: 'bearer' })
      .send({})
      .expect(({ body }) => {
        expect(body.message.sort()).toEqual(
          [
            'objective must be a valid enum value',
            'refCode must be a string',
            'countryCode must be a string',
            'mobileNumber must be a phone number',
          ].sort(),
        );
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return BAD_REQUEST when sending invalid objective', () => {
    return UsersRequest.updateMobile()
      .auth(guest.guestToken, { type: 'bearer' })
      .send({
        objective: OtpObjective.FORGOT_PASSWORD,
        refCode: 'ref-code',
        countryCode: 'country-code',
        mobileNumber: 'mobile-number',
      })
      .expect(({ body }) => {
        expect(body.message.sort()).toEqual(
          [
            'objective must be a valid enum value',
            'mobileNumber must be a phone number',
          ].sort(),
        );
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return FORBIDDEN_REQUEST when user is guest', () => {
    return UsersRequest.updateMobile()
      .auth(guest.guestToken, { type: 'bearer' })
      .send({
        objective: OtpObjective.VERIFY_MOBILE,
        refCode: 'ref-code',
        countryCode: 'country-code',
        mobileNumber: '0801231234',
      })
      .expect(({ body }) => {
        expect(body.message).toEqual(
          'Can not access the data. Please try again.',
        );
      })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should return MOBILE_NUMBER_IS_EXIST when mobile number has already exists', async () => {
    return UsersRequest.updateMobile()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({
        objective: 'verify_mobile',
        refCode: 'ref-code',
        countryCode: tempUser.countryCode,
        mobileNumber: tempUser.phone,
      })
      .expect(({ body }) => {
        expect(body.message).toEqual('This phone number is already exists.');
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return INVALID_REF_CODE when ref code is invalid or not found', async () => {
    return UsersRequest.updateMobile()
      .auth(tempUser.accessToken, { type: 'bearer' })
      .send({
        objective: OtpObjective.VERIFY_MOBILE,
        refCode: 'invalid-ref-code',
        countryCode: tempUser.countryCode,
        mobileNumber: tempUser.randomPhone(),
      })
      .expect(({ body }) => {
        expect(body.message).toEqual('Invalid ref code. Please try again.');
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return CREATED when updating mobile number successfully', () => {
    expect(updateMobileResponse.body.id).toBe(tempUser.id);
    expect(updateMobileResponse.body.verified.mobile).toBeTruthy();
    expect(updateMobileResponse.status).toBe(HttpStatus.OK);
  });
};
