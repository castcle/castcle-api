import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import {
  IsAfterDate,
  IsLessthanOrEqual,
} from '../validators/campaign.validator';

export class CampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  type: string;

  @IsNotEmpty()
  @IsNumber()
  totalRewards: number;

  @IsNotEmpty()
  @IsNumber()
  @Validate(IsLessthanOrEqual, ['totalRewards'])
  rewardBalance: number;

  @IsNotEmpty()
  @IsNumber()
  rewardsPerClaim: number;

  @IsOptional()
  @IsNumber()
  maxClaims: number;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  @Validate(IsAfterDate, ['startDate'])
  endDate: Date;
}

export class UpdateCampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  @Validate(IsAfterDate, ['startDate'])
  endDate: Date;
}

export class GetCampaignParams {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  campaignId: string;
}
