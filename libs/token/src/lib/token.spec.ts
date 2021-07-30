import { Token, TokenType } from './token';
import { AuthenticationToken } from './authenticationToken';
import { AuthenticationUserType } from './authenticationUserType.enum';
import { truncate } from 'fs';

describe('token', () => {
  it('should work', () => {
    const token = new Token();
    const payload: AuthenticationToken = {
      id: '12345678',
      type: AuthenticationUserType.Guest,
      name: 'Tanasin_Vivitvorn',
      firstName: 'Tanasinn',
      lastName: 'Vivitvorn',
      avatar: '',
      preferredLanguage: 'TH',
      verified: true
    };

    const tokenString = token.generateToken(payload, TokenType.Access);
    const result = token.validateToken(tokenString, TokenType.Access);
    expect(result.id).toEqual('12345678');
    expect(result.type).toEqual(AuthenticationUserType.Guest);
    expect(result.name).toEqual('Tanasin_Vivitvorn');
    expect(result.firstName).toEqual('Tanasinn');
    expect(result.lastName).toEqual('Vivitvorn');
    expect(result.avatar).toEqual('');
    expect(result.preferredLanguage).toEqual('TH');
    expect(result.verified).toEqual(true);
  });

  it('should work', () => {
    const token = new Token();
    const payload: AuthenticationToken = {
      id: '12345678',
      type: AuthenticationUserType.Member,
      name: 'TonyV',
      firstName: 'Tony',
      lastName: 'V',
      avatar: 'https://www.google.co.th',
      preferredLanguage: 'EN',
      verified: false
    };

    const tokenString = token.generateToken(payload, TokenType.Refresh);
    const result = token.validateToken(tokenString, TokenType.Refresh);
    expect(result.id).toEqual('12345678');
    expect(result.type).toEqual(AuthenticationUserType.Member);
    expect(result.name).toEqual('TonyV');
    expect(result.firstName).toEqual('Tony');
    expect(result.lastName).toEqual('V');
    expect(result.avatar).toEqual('https://www.google.co.th');
    expect(result.preferredLanguage).toEqual('EN');
    expect(result.verified).toEqual(false);
  });
});
