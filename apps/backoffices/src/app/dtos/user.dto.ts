import { IsEmail } from 'class-validator';

export class AccountDto {
  uid?: string;
  @IsEmail()
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface StaffSearchDto {
  firstName: string;
  lastName: string;
  email: string;
}

export enum StatusUser {
  ACTIVE = 'active',
}

export enum RoleUser {
  ADMINISTRATOR = 'administrator',
}
