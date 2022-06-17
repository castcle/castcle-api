import { Reporting } from '@castcle-api/database';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pagination } from '../dtos/pagination';

@Injectable()
export class ReportService {
  constructor(@InjectModel('Reporting') public reportModel: Model<Reporting>) {}

  getReport(page: Pagination) {
    return this.reportModel.find().skip(page.offset).limit(page.limit);
  }
}
