import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  CredentialRequest,
  HeadersInterceptor,
} from '@castcle-api/utils/interceptors';
import {
  Body,
  Get,
  HttpCode,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ExpiredDto,
  LoginDto,
  LogoutDto,
  ResetPasswordDto,
} from '../dtos/authentication.dto';
import { AccountDto, StaffSearchDto } from '../dtos/user.dto';
import { CredentialInterceptor } from '../interceptors/credential.interceptor';
import { HeaderBackofficeInterceptor } from '../interceptors/header-backoffice.interceptor';
import { AuthenticationService } from '../services/authentication.service';

@CastcleControllerV2({ path: 'backoffices' })
export class AuthenticationController {
  constructor(private authService: AuthenticationService) {}

  @UseInterceptors(HeadersInterceptor, HeaderBackofficeInterceptor)
  @Post('login/email')
  @HttpCode(200)
  async login(@Body() { email, password }: LoginDto) {
    return await this.authService.getAccountFromEmail(email, password);
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('create')
  @HttpCode(201)
  async createAccount(@Body() body: AccountDto) {
    return await this.authService.createAccountFromEmail(body);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('staff-list')
  @HttpCode(200)
  async staffList(@Body() body: StaffSearchDto) {
    return await this.authService.getStaffList(body);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() { uid }: LogoutDto) {
    const deleteSession: any = await this.authService.deleteSession(uid);
    if (deleteSession.deleteCount) {
      return { delete: deleteSession.deleteCount };
    }
    throw CastcleException.INTERNAL_SERVER_ERROR;
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() { uid }: ResetPasswordDto) {
    return await this.authService.resetPassword(uid);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('update')
  @HttpCode(204)
  async updateAccount(@Body() body: AccountDto) {
    await this.authService.updateAccount(body);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Get('session')
  @HttpCode(200)
  async checkSession(@Req() req: CredentialRequest) {
    const session = await this.authService.checkSession(req['$payload']);
    if (session) return { session };
    throw CastcleException.INVALID_ACCESS_TOKEN;
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('expired')
  @HttpCode(200)
  async expired(@Body() { id }: ExpiredDto) {
    const deleteSession: any = await this.authService.deleteSessionOne(id);
    if (deleteSession.deleteCount) return { delete: deleteSession.deleteCount };
    throw CastcleException.INTERNAL_SERVER_ERROR;
  }
}
