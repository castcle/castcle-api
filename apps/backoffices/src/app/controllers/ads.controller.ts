import { CastcleController } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Body, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { AdsApproveDto, AdsDeclineDto, AdsSearchDto } from '../dtos/ads.dto';
import { MongoIdParam } from '../dtos/campaign.dto';
import { CredentialInterceptor } from '../interceptors/credential.interceptor';
import { AdsCampaignService } from '../services/ads-campaign.service';

@CastcleController({ path: 'ads', version: '1.0' })
export class AdsController {
  constructor(private adsService: AdsCampaignService) {}

  @UseInterceptors(CredentialInterceptor)
  @Post('ads-list')
  @HttpCode(200)
  async adsList(@Body() body: AdsSearchDto) {
    return this.adsService.adsList(body);
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('ads-detail')
  @HttpCode(200)
  async adsDetail(@Body() { id }: MongoIdParam) {
    return await this.adsService.adsDetail(id);
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('ads-approve')
  @HttpCode(200)
  async adsApprove(@Body() body: AdsApproveDto) {
    const change: any = await this.adsService.adsChangeUpdate(body._id);
    if (change) {
      if (
        new Date(change.updatedAt).getTime() !==
        new Date(body.updatedAt).getTime()
      ) {
        return { message: 'change' };
      }
      const approveAction = await this.adsService.adsApprove(
        body,
        change.duration,
      );
      if (approveAction.nModified > 0) return { message: 'Approve Success.' };
    }
    throw CastcleException.SOMETHING_WRONG;
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('ads-decline')
  @HttpCode(200)
  async adsDecline(@Body() body: AdsDeclineDto) {
    const change: any = await this.adsService.adsChangeUpdate(body._id);
    if (change) {
      if (
        new Date(change.updatedAt).getTime() !==
        new Date(body.updatedAt).getTime()
      ) {
        return { message: 'change' };
      }
      const declineAction = await this.adsService.adsDecline(body);
      if (declineAction.nModified > 0) {
        return { message: 'Decline Success.' };
      }
    }
    throw CastcleException.SOMETHING_WRONG;
  }
}
