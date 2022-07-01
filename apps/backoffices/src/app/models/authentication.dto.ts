import { IsEmail, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class StaffDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;
}

export class GetStaffParams {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  staffId: string;
}

export interface AccessTokenPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  accessTokenExpiresTime?: string;
  session?: string;
}
