export class User {
  castcleId: string;
  deviceUUID: string;
  displayName: string;
  email: string;
  countryCode = '+66';
  phone = Date.now().toString().slice(-8);
  password = 'n+4H&uME63gKv[=';
  referrer: string;

  id: string;
  accountId: string;
  accessToken: string;
  guestToken: string;
  refreshToken: string;

  constructor({ name, referrer }: { name: string; referrer?: string }) {
    this.castcleId = `${name}.castcle`;
    this.deviceUUID = name;
    this.displayName = name;
    this.email = `${name}@castcle.com`;
    this.referrer = referrer;
  }

  toRegisterPayload = () => ({
    channel: 'email',
    referral: this.referrer,
    payload: {
      castcleId: this.castcleId,
      displayName: this.displayName,
      email: this.email,
      password: this.password,
    },
  });

  toMemberLoginPayload = () => ({
    username: this.email,
    password: this.password,
  });

  toVerificationPasswordPayload = () => ({
    objective: 'change_password',
    password: this.password,
  });

  randomPhone = () => Date.now().toString().slice(-8);
}
