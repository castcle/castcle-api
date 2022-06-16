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
export interface AdsApproveDto {
  _id: string;
  updatedAt: Date;
}

export interface AdsDeclineDto {
  _id: string;
  statusReason: Object;
  updatedAt: Date;
}

export interface AdsChangeDto {
  _id: string;
}
