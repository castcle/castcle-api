import { IsDateString, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export interface AdsTableDto {
  campaign_no: string;
  campaign_name: string;
  type: string;
  date: any;
  status: string;
  action: string;
}

export interface AdsSearchDto {
  campaign_no: string;
  campaign_name: string;
  status: string;
}
export class AdsApproveDto {
  @IsMongoId()
  @IsNotEmpty()
  @IsString()
  _id: string;

  @IsNotEmpty()
  @IsDateString()
  updatedAt: Date;
}

export interface AdsDeclineDto {
  _id: string;
  statusReason: any;
  updatedAt: Date;
}

export interface AdsChangeDto {
  _id: string;
}
