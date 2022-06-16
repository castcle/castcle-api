import { CastcleController } from '@castcle-api/utils/decorators';
import {
  Body,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { CampaignDto } from '../dtos/campaign.dto';
import { CredentialInterceptor } from '../interceptors/credential.interceptor';
import { CampaignTypeService } from '../services/campaign-type.service';

@CastcleController({ path: 'campaign-type', version: '1.0' })
export class CampaignTypeController {
  constructor(private campaignService: CampaignTypeService) {}

  @UseInterceptors(CredentialInterceptor)
  @Post('')
  @HttpCode(201)
  async addCampaignType(@Body() body: CampaignDto) {
    const addCampaign = await this.campaignService.addCampaignType(body);
    return { payload: addCampaign };
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('/list')
  @HttpCode(200)
  async campaignList(@Body() body?: CampaignDto) {
    return { payload: await this.campaignService.campaignList(body) };
  }

  @UseInterceptors(CredentialInterceptor)
  @Put(':id')
  @HttpCode(200)
  async updateCampaign(@Param('id') id: string, @Body() body?: CampaignDto) {
    return { payload: await this.campaignService.updateCampaignType(id, body) };
  }

  @UseInterceptors(CredentialInterceptor)
  @Delete(':id')
  @HttpCode(200)
  deleteCampaign(@Param('id') id: string) {
    return this.campaignService.deleteCampaignType(id);
  }
}
