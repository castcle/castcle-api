import { IsEmail, IsNotEmpty } from 'class-validator';

export class AccountDto {
  id?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  password?: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;
}

export enum StatusUser {
  ACTIVE = 'active',
}

export enum RoleUser {
  ADMINISTRATOR = 'administrator',
}
