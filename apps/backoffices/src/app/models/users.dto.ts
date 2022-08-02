import { PaginationQuery } from '@castcle-api/database';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UserQuery extends PaginationQuery {
  @IsString()
  @IsOptional()
  keyword: string;

  @IsNumber()
  @Type(() => Number)
  page = 0;
}
