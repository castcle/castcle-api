export interface User {
  username: string;
  id: number | string;
}

export interface AccountDto {
  uid?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface StaffTableDto {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  regDate: any;
  action: string;
}

export interface StaffSearchDto {
  firstName: string;
  lastName: string;
  email: string;
}
