export class User {
  castcleId: string;
  deviceUUID: string;
  displayName: string;
  email: string;
  password = 'n+4H&uME63gKv[=';

  id: string;
  accessToken: string;
  guestToken: string;

  constructor(name: string) {
    this.castcleId = `${name}.castcle`;
    this.deviceUUID = name;
    this.displayName = name;
    this.email = `${name}@castcle.com`;
  }

  toRegisterPayload = () => ({
    channel: 'email',
    payload: {
      castcleId: this.castcleId,
      displayName: this.displayName,
      email: this.email,
      password: this.password,
    },
  });
}
