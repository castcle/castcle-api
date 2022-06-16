import { CastcleController } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { UseInterceptors, Post, HttpCode, Body, Req } from '@nestjs/common';
import { AdsSearchDto, AdsApproveDto, AdsDeclineDto } from '../dtos/ads.dto';
import {
  CredentialInterceptor,
  CredentialRequest,
} from '../interceptors/credential.interceptor';
import { AdsCampaignService } from '../services/ads-campaign.service';

@CastcleController({ path: 'ads', version: '1.0' })
export class AppController {
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
  async adsDetail(@Req() req: CredentialRequest, @Body() { _id }: any) {
    let ads = await this.adsService.adsDetail(_id);
    if (ads.length) {
      if (ads[0].boostType === 'content') {
        ads[0].payload = await this.adsService.adsContent(ads[0].previewRef);
      } else {
        ads[0].payload = await this.adsService.adsPage(ads[0].previewRef);
      }
    }
    return ads;
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
      if (approveAction['modifiedCount']) {
        return { message: 'success' };
      }
    }
    throw CastcleException.SOMETHING_WRONG;
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('ads-decline')
  @HttpCode(200)
  async adsDecline(@Req() req: CredentialRequest, @Body() body: AdsDeclineDto) {
    const change: any = await this.adsService.adsChangeUpdate(body._id);
    if (change) {
      if (
        new Date(change.updatedAt).getTime() !==
        new Date(body.updatedAt).getTime()
      ) {
        return { message: 'change' };
      }
      const declineAction = await this.adsService.adsDecline(body);
      if (declineAction['modifiedCount']) {
        return { message: 'success' };
      }
    }
    throw CastcleException.SOMETHING_WRONG;
  }
}
