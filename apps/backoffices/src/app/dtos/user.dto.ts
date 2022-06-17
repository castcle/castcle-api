export interface AccountDto {
  uid?: string;
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
