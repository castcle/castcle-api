import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import { HeadersInterceptor } from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CredentialGuard } from '../guards/credential.guard';
import {
  PermissionGuard,
  RequiredPermissions,
} from '../guards/permisson.guard';
import { HeaderBackofficeInterceptor } from '../interceptors/header-backoffice.interceptor';
import {
  GetStaffParams,
  LoginDto,
  StaffDto,
} from '../models/authentication.dto';
import { Permission } from '../models/authentication.enum';
import { Staff } from '../schemas/staff.schema';
import { AuthenticationService } from '../services/authentication.service';

@CastcleControllerV2({ path: 'backoffices' })
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

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('staff')
  @HttpCode(201)
  createStaff(@Body() body: StaffDto) {
    return this.authService.createStaffFromEmail(body);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Get('staff')
  @HttpCode(200)
  getStaffs() {
    return this.authService.getStaffs();
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('staff/:staffId/reset/password')
  @HttpCode(200)
  resetPassword(@Param() { staffId }: GetStaffParams) {
    return this.authService.resetPassword(staffId);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Delete('staff/:staffId')
  @HttpCode(200)
  deleteStaff(@Param() { staffId }: GetStaffParams) {
    return this.authService.deleteStaff(staffId);
  }
}
