import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { StaffRole } from './authentication.enum';

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
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsEnum(StaffRole)
  @IsNotEmpty()
  role: StaffRole;
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
