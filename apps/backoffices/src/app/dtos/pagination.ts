import { DEFAULT_QUERY_OPTIONS } from '@castcle-api/database';
import { IsNumber, IsOptional } from 'class-validator';

export class Pagination {
  @IsOptional()
  @IsNumber()
  limit = DEFAULT_QUERY_OPTIONS.limit;

  @IsOptional()
  @IsNumber()
  offset = 0;
}
