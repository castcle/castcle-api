import { ResponseDto } from '@castcle-api/database';
import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import {
  Body,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CredentialGuard } from '../guards/credential.guard';
import {
  PermissionGuard,
  RequiredPermissions,
} from '../guards/permisson.guard';
import { HeaderBackofficeInterceptor } from '../interceptors/header-backoffice.interceptor';
import { Permission } from '../models/authentication.enum';
import {
  CampaignDto,
  GetCampaignParams,
  UpdateCampaignDto,
} from '../models/campaign.dto';
import { CampaignBackofficeService } from '../services/campaign.service';

@CastcleControllerV2({ path: 'backoffices' })
export class CampaignController {
  constructor(private campaignService: CampaignBackofficeService) {}

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Post('campaigns')
  @HttpCode(201)
  createCampaign(@Body() campaign: CampaignDto) {
    return this.campaignService.createCampaign(campaign);
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Get('campaigns')
  @HttpCode(200)
  async getCampaigns() {
    return ResponseDto.ok({
      payload: await this.campaignService.getCampaigns(),
    });
  }

  @UseInterceptors(HeaderBackofficeInterceptor)
  @UseGuards(CredentialGuard, PermissionGuard)
  @RequiredPermissions(Permission.Manage)
  @Put('campaigns/:campaignId')
  @HttpCode(201)
  updateCampaign(
    @Param() { campaignId }: GetCampaignParams,
    @Body() campaign: UpdateCampaignDto,
  ) {
    return this.campaignService.updateCampaign(campaignId, campaign);
  }
}
