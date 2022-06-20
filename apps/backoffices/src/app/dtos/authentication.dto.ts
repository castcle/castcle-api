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

export class AccountDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  password: string;
  @IsString()
  @IsNotEmpty()
  firstName: string;
  @IsString()
  @IsNotEmpty()
  lastName: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  uid: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  uid: string;
}

export class ExpiredDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
