import {
  TransformSortStringToSortObject,
  TransformStringToArrayOfStrings,
} from '@castcle-api/common';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
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
