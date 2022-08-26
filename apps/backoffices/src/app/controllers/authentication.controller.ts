import { CastcleController } from '@castcle-api/utils/decorators';
import { HeadersInterceptor } from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BackofficeAuth } from '../decorators';
import { CredentialGuard } from '../guards/credential.guard';
import { RequiredPermissions } from '../guards/permission.guard';
import { HeaderBackofficeInterceptor } from '../interceptors/header-backoffice.interceptor';
import {
  ChangePasswordDto,
  GetStaffParams,
  LoginDto,
  StaffDto,
} from '../models/authentication.dto';
import { Permission } from '../models/authentication.enum';
import { Staff } from '../schemas/staff.schema';
import { AuthenticationService } from '../services/authentication.service';

@CastcleController({ path: 'v2/backoffices' })
export class AuthenticationController {
  constructor(private authService: AuthenticationService) {}

  @UseInterceptors(HeadersInterceptor, HeaderBackofficeInterceptor)
  @Post('login/email')
  @HttpCode(200)
  login(@Body() { email, password }: LoginDto) {
    return this.authService.getStaffFromEmail(email, password);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard)
  @Post('logout')
  @HttpCode(200)
  logout(@Req() { $payload }: FastifyRequest & { $payload: Staff }) {
    return this.authService.removeToken($payload.id);
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Post('staff')
  @HttpCode(201)
  createStaff(@Body() body: StaffDto) {
    return this.authService.createStaffFromEmail(body);
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Get('staff')
  @HttpCode(200)
  getStaffs() {
    return this.authService.getStaffs();
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Post('staff/:staffId/reset/password')
  @HttpCode(200)
  resetPassword(@Param() { staffId }: GetStaffParams) {
    return this.authService.resetPassword(staffId);
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Delete('staff/:staffId')
  @HttpCode(200)
  deleteStaff(@Param() { staffId }: GetStaffParams) {
    return this.authService.deleteStaff(staffId);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard)
  @Put('staff/change-password')
  @HttpCode(200)
  changePassword(
    @Req() { $payload }: FastifyRequest & { $payload: Staff },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword($payload.id, body);
  }
}
