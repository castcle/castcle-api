import { Token } from '@castcle-api/utils/commons';
import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import { HeadersInterceptor } from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LoginDto } from '../dtos/authentication.dto';
import { AccountDto, RoleUser } from '../dtos/user.dto';
import { RoleGuard, Roles } from '../guards/role.guard';
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

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('Authorization') auth: string) {
    const payload = Token.decodeToken<AccountDto>(
      auth.replace(/Bearer\s+/, ''),
    );
    return await this.authService.removeToken(payload.id);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @UseGuards(RoleGuard)
  @Roles([RoleUser.ADMINISTRATOR])
  @Post('staff')
  @HttpCode(201)
  async createStaff(@Body() body: AccountDto) {
    return await this.authService.createAccountFromEmail(body);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @UseGuards(RoleGuard)
  @Roles([RoleUser.ADMINISTRATOR])
  @Get('staff')
  @HttpCode(200)
  async getStaffs() {
    return await this.authService.getStaffs();
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @UseGuards(RoleGuard)
  @Roles([RoleUser.ADMINISTRATOR])
  @Post('staff/:staffId/reset/password')
  @HttpCode(200)
  async resetPassword(@Param('staffId') staffId: string) {
    return await this.authService.resetPassword(staffId);
  }

  @UseInterceptors(CredentialInterceptor, HeaderBackofficeInterceptor)
  @UseGuards(RoleGuard)
  @Roles([RoleUser.ADMINISTRATOR])
  @Delete('staff/:staffId')
  @HttpCode(200)
  async deleteStaff(@Param('staffId') staffId: string) {
    return await this.authService.deleteStaff(staffId);
  }
}
