import {
  TransformStringToArrayOfStrings,
  TransformSortStringToSortObject,
} from '@castcle-api/utils/commons';
import { IsOptional, IsEnum, IsObject } from 'class-validator';
import { UserType } from '../models';
import { PaginationQuery } from './pagination.dto';

export class GetFollowQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(UserType, { each: true })
  @TransformStringToArrayOfStrings()
  type?: string[];

  @IsOptional()
  @IsObject()
  @TransformSortStringToSortObject()
  sort?: string;
}
