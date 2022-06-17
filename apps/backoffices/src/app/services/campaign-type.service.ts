import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CampaignDto, UpdateCampaignDto } from '../dtos/campaign.dto';
import { CampaignType } from '../schemas/campaign-type.schema';

@Injectable()
export class CampaignTypeService {
  constructor(
    @InjectModel('CampaignType') public campaignModel: Model<CampaignType>,
  ) {}

  async getCampaignType() {
    return await this.campaignModel.find();
  }

  async addCampaignType(campaign: CampaignDto) {
    const createdCampaign = new this.campaignModel(campaign);
    return await createdCampaign.save().catch(() => {
      throw CastcleException.SLUG_IS_EXIST;
    });
  }

  async updateCampaignType(_id: string, campaign: UpdateCampaignDto) {
    return await this.campaignModel.updateOne({ _id }, campaign).catch(() => {
      throw CastcleException.SLUG_IS_EXIST;
    });
  }

  async deleteCampaignType(_id: string) {
    return await this.campaignModel.remove({ _id });
  }
}
