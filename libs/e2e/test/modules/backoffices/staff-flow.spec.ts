import { BackofficesRequest } from '../../requests';

export const testStaffFlow = () => {
  let accessToken = '';
  let newStaff;

  it('STEP 1: Should Login failed when user does not exist', async () => {
    await BackofficesRequest.login()
      .send({
        email: 'testx@castcle.com',
        password: 'testx',
      })
      .expect(({ status }) => {
        expect(status).toEqual(400);
      });
  });

  it('STEP 2: Should Login success when user is exist', async () => {
    await BackofficesRequest.login()
      .send({
        email: 'test@castcle.com',
        password: 'test',
      })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        accessToken = body.accessToken;
      });
  });

  it('STEP 3: Should create staff', async () => {
    await BackofficesRequest.createStaff()
      .auth(accessToken, { type: 'bearer' })
      .send({
        firstName: 'Bob',
        lastName: 'Ja',
        role: 'viewer',
        email: 'test2@castcle.com',
      })
      .expect(({ status }) => {
        expect(status).toEqual(201);
      });
  });

  it('STEP 4: Should change password staff error', async () => {
    await BackofficesRequest.changePassword()
      .auth(accessToken, { type: 'bearer' })
      .send({
        oldPassword: 'testtest',
        newPassword: 'changeNaja',
      })
      .expect(({ status }) => {
        expect(status).toEqual(400);
      });
  });

  it('STEP 5: Should change password staff', async () => {
    await BackofficesRequest.changePassword()
      .auth(accessToken, { type: 'bearer' })
      .send({
        oldPassword: 'test',
        newPassword: 'changeNaja',
      })
      .expect(({ status }) => {
        expect(status).toEqual(200);
      });
  });

  it('STEP 6: Should relogin after change password', async () => {
    await BackofficesRequest.login()
      .send({
        email: 'test@castcle.com',
        password: 'changeNaja',
      })
      .expect(({ body }) => {
        expect(body.accessToken).toBeDefined();
        accessToken = body.accessToken;
      });
  });

  it('STEP 7: Should return all staff in collection', async () => {
    await BackofficesRequest.getStaffs()
      .auth(accessToken, { type: 'bearer' })
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        newStaff = body[1];
      });
  });

  it('STEP 8: Should reset password user is exist', async () => {
    await BackofficesRequest.resetPassword(newStaff._id)
      .auth(accessToken, { type: 'bearer' })
      .expect(({ status }) => {
        expect(status).toEqual(200);
      });
  });

  it('STEP 9: Should reset password failed if user does not exist ', async () => {
    await BackofficesRequest.resetPassword('62beba95da7ae63fcf187dd3')
      .auth(accessToken, { type: 'bearer' })
      .expect(({ status }) => {
        expect(status).toEqual(404);
      });
  });

  it('STEP 10: Should Delete user', async () => {
    await BackofficesRequest.deleteStaff(newStaff._id)
      .auth(accessToken, { type: 'bearer' })
      .expect(({ status }) => {
        expect(status).toEqual(200);
      });
  });

  it('STEP 11: Should reset password to default', async () => {
    await BackofficesRequest.changePassword()
      .auth(accessToken, { type: 'bearer' })
      .send({
        oldPassword: 'changeNaja',
        newPassword: 'test',
      })
      .expect(({ status }) => {
        expect(status).toEqual(200);
      });
  });
};
