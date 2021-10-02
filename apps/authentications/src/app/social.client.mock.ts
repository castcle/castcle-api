export class FacebookClientMock {
  getAccessToken() {
    return {
      access_token: '210058044|uBgVr1NhacSzS7UtJ387yI',
      token_type: 'bearer'
    };
  }

  verifyUserToken(accessToken: string, userToken: string) {
    if (userToken) {
      return {
        app_id: '210058044',
        type: 'USER',
        application: 'Castcle - DEV',
        data_access_expires_at: 1640877720,
        expires_at: 1633107600,
        is_valid: true,
        metadata: {
          auth_type: 'rerequest'
        },
        scopes: ['email', 'public_profile'],
        user_id: userToken
      };
    } else {
      return {
        app_id: '210058044',
        type: 'USER',
        application: 'Castcle - DEV',
        data_access_expires_at: 1640877720,
        expires_at: 1633107600,
        is_valid: false,
        metadata: {
          auth_type: 'rerequest'
        },
        scopes: ['email', 'public_profile'],
        user_id: userToken
      };
    }
  }

  getUserInfo(userToken: string) {
    if (userToken === 'test_empty') {
      return null;
    } else {
      return {
        first_name: 'John',
        last_name: 'Block',
        picture: {
          data: {
            height: 50,
            is_silhouette: false,
            url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=109364223&height=50&width=50&ext=1635588772&hash=AeQnpX0QDwSuye2Q-ZA',
            width: 50
          }
        },
        email: 'jb@gmail.com',
        name: 'John Block',
        id: userToken
      };
    }
  }
}
