import { HttpStatus } from '@nestjs/common';
import { ErrorMessages } from 'libs/utils/exception/src/lib/messages/default';
import { UsersRequest } from '../../requests';
import { userAlpha, userBeta } from '../../variables';

export const testUsersReporting = () => {
  it('should return validation failed when sending empty request body', () => {
    return UsersRequest.report(userAlpha.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({})
      .expect(({ body }) => {
        expect(body.message.sort()).toEqual(
          [
            'message should not be empty',
            'message must be a string',
            'targetCastcleId should not be empty',
            'targetCastcleId must be a string',
            'targetContentId should not be empty',
            'targetContentId must be a string',
          ].sort()
        );
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should return no content when reporting existing user with castcle ID', () => {
    return UsersRequest.report(userAlpha.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ message: 'spam', targetCastcleId: userBeta.castcleId })
      .expect(({ body }) => {
        expect(body).toEqual({});
      })
      .expect(HttpStatus.NO_CONTENT);
  });

  it('should return no content when reporting existing user with user ID', () => {
    return UsersRequest.report(userAlpha.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ message: 'spam', targetCastcleId: userBeta.id })
      .expect(({ body }) => {
        expect(body).toEqual({});
      })
      .expect(HttpStatus.NO_CONTENT);
  });

  it('should return user not found when reporting user that does not exist', () => {
    return UsersRequest.report(userAlpha.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ message: 'spam', targetCastcleId: '61dd5e36acf08f6cfe74f0ea' })
      .expect(({ body }) => {
        expect(body).toEqual(ErrorMessages[4001]);
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should return content not found when reporting content that does not exist', () => {
    return UsersRequest.report(userAlpha.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ message: 'spam', targetContentId: '61dd5e36acf08f6cfe74f0ea' })
      .expect(({ body }) => {
        expect(body).toEqual(ErrorMessages[5003]);
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should return forbidden when user who report is not match with requester', () => {
    return UsersRequest.report(userBeta.id)
      .auth(userAlpha.accessToken, { type: 'bearer' })
      .send({ message: 'Spam', targetCastcleId: userBeta.id })
      .expect(({ body }) => {
        expect(body).toEqual(ErrorMessages[1007]);
      })
      .expect(HttpStatus.FORBIDDEN);
  });
};
