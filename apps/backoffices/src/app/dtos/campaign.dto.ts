import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CampaignDto {
  _id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug: string;
}

export class MongoIdParam {
  @IsMongoId()
  @IsNotEmpty()
  id: string;
}
