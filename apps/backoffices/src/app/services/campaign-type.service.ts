import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CampaignDto } from '../dtos/campaign.dto';
import { CampaignType } from '../schemas/campaign-type.schema';

@Injectable()
export class CampaignTypeService {
  constructor(
    @InjectModel('CampaignType') public campaignModel: Model<CampaignType>,
  ) {}

  async campaignList(campaign?: CampaignDto) {
    const campaignTypes = await this.campaignModel.find();
    if (campaign.name || campaign.slug) {
      const filter = Object.entries(campaign).reduce((result, entry) => {
        const [key, value] = entry;
        if (value) {
          result[key] = value;
        }

        return result;
      }, {});

      const searchCampaign = campaignTypes.filter((item) => {
        const campaignValue = (item as any)._doc;
        const filteredValue = Object.keys(campaignValue).filter((key) => {
          return campaignValue[key]
            .toString()
            .toLowerCase()
            .includes(filter[key]?.toString().toLowerCase());
        });

        return filteredValue.length > 0;
      });

      return searchCampaign;
    }
    return campaignTypes;
  }

  async addCampaignType(campaign: CampaignDto) {
    try {
      const createdCampaign = new this.campaignModel(campaign);
      return await createdCampaign.save();
    } catch (error) {
      throw CastcleException.SOMETHING_WRONG;
    }
  }

  async updateCampaignType(_id: string, campaign: CampaignDto) {
    return await this.campaignModel.updateOne({ _id }, campaign);
  }

  async deleteCampaignType(_id: string) {
    return await this.campaignModel.remove({ _id });
  }
}
