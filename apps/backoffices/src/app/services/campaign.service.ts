import { Campaign, CampaignType } from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CampaignDto, UpdateCampaignDto } from '../models/campaign.dto';

@Injectable()
export class CampaignBackofficeService {
  constructor(@InjectModel('Campaign') public campaignModel: Model<Campaign>) {}

  getCampaigns() {
    return this.campaignModel.find();
  }

  async createCampaign(campaign: CampaignDto) {
    const campaignExist = await this.campaignModel.findOne({
      type: campaign.type as CampaignType,
    });

    if (campaignExist) throw new CastcleException('CAMPAIGN_TYPE_IS_EXIST');

    await this.campaignModel.create(campaign);
  }

  async updateCampaign(
    campaignId: string,
    { name, startDate, endDate }: UpdateCampaignDto,
  ) {
    const updateCampaign = await this.campaignModel.updateOne(
      { _id: campaignId },
      {
        name,
        startDate,
        endDate,
      },
    );

    if (updateCampaign.nModified === 0)
      throw new CastcleException('CAMPAIGN_NOT_FOUND');
  }
}
