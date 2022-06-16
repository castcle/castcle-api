import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { AdsApproveDto, AdsDeclineDto, AdsSearchDto } from '../dtos/ads.dto';
import { CastcleImage } from '../dtos/common.dto';
import { AdsBoostStatus, AdsStatus } from '../models';
import { AdsCampaign } from '../schemas/ads-campaign.schema';
import { ContentDocument } from '../schemas/content.schema';
import { UserDocument } from '../schemas/user.schema';
import { Image } from '../utils/image';

@Injectable()
export class AdsCampaignService {
  constructor(
    @InjectModel('AdsCampaign') public adsCampaignModel: Model<AdsCampaign>,
    @InjectModel('Content') public contentModel: Model<ContentDocument>,
    @InjectModel('User') public userModel: Model<UserDocument>,
  ) {}

  async adsList({ campaign_no, campaign_name, status }: AdsSearchDto) {
    let state: any = [],
      query: any = [];
    if (campaign_no || campaign_name || status) {
      if (campaign_no) {
        state.push({
          'detail.code': { $regex: campaign_no, $options: 'i' },
        });
      }
      if (campaign_name) {
        state.push({
          'detail.name': { $regex: campaign_name, $options: 'i' },
        });
      }
      if (status) {
        state.push({
          status: { $eq: status },
        });
      }
    }

    if (state.length) {
      query = [...query, { $match: { $and: state } }];
    }

    query = [
      ...query,
      {
        $project: {
          campaignName: '$detail.name',
          campaignCode: '$detail.code',
          status: '$status',
          type: {
            $cond: [{ $eq: ['$adsRef.$ref', 'user'] }, 'page', '$adsRef.$ref'],
          },
          date: '$createdAt',
        },
      },
    ];
    return await this.adsCampaignModel.aggregate(query);
  }

  async adsDetail(_id: string) {
    return await this.adsCampaignModel.aggregate([
      {
        $match: {
          $and: [{ _id: new mongoose.Types.ObjectId(_id) }],
        },
      },
      {
        $project: {
          campaignName: '$detail.name',
          campaignMessage: '$detail.message',
          campaignCode: '$detail.code',
          objective: '$objective',
          dailyBudget: '$detail.dailyBudget',
          duration: '$detail.duration',
          adStatus: '$status',
          boostStatus: '$boostStatus',
          boostType: '$adsRef.$ref',
          createdAt: '$createdAt',
          startedAt: { $ifNull: ['$startedAt', null] },
          endedAt: { $ifNull: ['$endedAt', null] },
          updatedAt: '$updatedAt',
          previewRef: '$adsRef.$id',
        },
      },
    ]);
  }

  async adsPage(ref: any) {
    const payload: any = await this.userModel.findOne({ _id: ref }).exec();
    if (payload.profile?.image?.avatar) {
      payload.profile.image.avatar = payload.profile?.image
        ?.avatar as CastcleImage[];
      if (!payload.profile?.image?.avatar['isSign']) {
        payload.profile.image.avatar = new Image(
          payload.profile?.image?.avatar,
        ).toSignUrls();
      } else {
        payload.profile.image.avatar = payload.profile?.image?.avatar;
      }
    }
    if (payload.profile?.image?.cover) {
      payload.profile.image.cover = payload.profile?.image
        ?.cover as CastcleImage[];
      if (!payload.profile?.image?.cover['isSign']) {
        payload.profile.image.cover = new Image(
          payload.profile?.image?.cover,
        ).toSignUrls();
      } else {
        payload.profile.image.cover = payload.profile?.image?.cover;
      }
    }
    return payload;
  }

  async adsContent(ref: any) {
    const payload: any = await this.contentModel.findOne({ _id: ref }).exec();
    if (payload.payload?.photo?.contents) {
      payload.payload.photo.contents = (
        payload.payload.photo.contents as CastcleImage[]
      ).map((url: CastcleImage) => {
        if (!url['isSign']) {
          return new Image(url).toSignUrls();
        } else {
          return url;
        }
      });
    }

    if (payload.author?.avatar) {
      payload.author.avatar = payload.author.avatar as CastcleImage[];
      if (!payload.author?.avatar['isSign']) {
        payload.author.avatar = new Image(payload.author.avatar).toSignUrls();
      } else {
        payload.author.avatar = payload.author.avatar;
      }
    }

    return payload;
  }

  async adsApprove({ _id }: AdsApproveDto, duration: number) {
    const dateNow = new Date();
    return await this.adsCampaignModel.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      {
        $set: {
          status: AdsStatus['Approved'],
          boostStatus: AdsBoostStatus['Running'],
          startedAt: dateNow,
          endedAt: new Date(moment(dateNow).add(duration, 'days').format()),
          updatedAt: new Date(),
        },
      },
    );
  }
  async adsChangeUpdate(_id: any) {
    return await this.adsCampaignModel
      .findOne({ _id: { $eq: new mongoose.Types.ObjectId(_id) } })
      .exec();
  }

  async adsDecline({ _id, statusReason }: AdsDeclineDto) {
    return await this.adsCampaignModel.updateOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      {
        $set: {
          status: AdsStatus['Declined'],
          statusReason: statusReason,
          updatedAt: new Date(),
        },
      },
    );
  }
}
