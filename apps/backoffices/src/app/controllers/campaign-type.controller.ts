import { ResponseDto } from '@castcle-api/database';
import { CastcleController } from '@castcle-api/utils/decorators';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import {
  CampaignDto,
  MongoIdParam,
  UpdateCampaignDto,
} from '../dtos/campaign.dto';
import { CredentialInterceptor } from '../interceptors/credential.interceptor';
import { CampaignTypeService } from '../services/campaign-type.service';

@CastcleController({ path: 'campaign-type', version: '1.0' })
export class CampaignTypeController {
  constructor(private campaignService: CampaignTypeService) {}

  @UseInterceptors(CredentialInterceptor)
  @Post('')
  @HttpCode(201)
  async addCampaignType(@Body() body: CampaignDto) {
    return ResponseDto.ok({
      payload: await this.campaignService.addCampaignType(body),
    });
  }

  @UseInterceptors(CredentialInterceptor)
  @Get('')
  @HttpCode(200)
  async campaignList() {
    return ResponseDto.ok({
      payload: await this.campaignService.getCampaignType(),
    });
  }

  @UseInterceptors(CredentialInterceptor)
  @Put(':id')
  @HttpCode(200)
  async updateCampaign(
    @Param('id') { id }: MongoIdParam,
    @Body() body?: UpdateCampaignDto,
  ) {
    return ResponseDto.ok({
      payload: await this.campaignService.updateCampaignType(id, body),
    });
  }

  @UseInterceptors(CredentialInterceptor)
  @Delete(':id')
  @HttpCode(204)
  async deleteCampaign(@Param('id') { id }: MongoIdParam) {
    await this.campaignService.deleteCampaignType(id);
  }
}
