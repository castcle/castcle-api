/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */

import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
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
import { Permission } from '../models/authentication.enum';
import { GetReportingQuery, UpdateIllegal } from '../models/reporting.dto';
import { Staff } from '../schemas/staff.schema';
import { ReportingService } from '../services/reporting.service';

@CastcleControllerV2({ path: 'backoffices' })
export class ReportingController {
  constructor(private reportingService: ReportingService) {}

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Get('reporting')
  getReporting(@Query() query: GetReportingQuery) {
    return this.reportingService.getReporting(query);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('reporting/not-illegal')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateNotIllegal(
    @Req() { $payload }: FastifyRequest & { $payload: Staff },
    @Body() body: UpdateIllegal,
  ) {
    return this.reportingService.updateNotIllegal(body, $payload);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('reporting/illegal')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateIllegal(
    @Req() { $payload }: FastifyRequest & { $payload: Staff },
    @Body() body: UpdateIllegal,
  ) {
    return this.reportingService.updateIllegal(body, $payload);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('reporting/auto-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateAutoDelete(@Req() { $payload }: FastifyRequest & { $payload: Staff }) {
    return this.reportingService.updateAutoDelete($payload);
  }
}
