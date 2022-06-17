import { ResponseDto } from '@castcle-api/database';
import { CastcleController } from '@castcle-api/utils/decorators';
import { Body, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { Pagination } from '../dtos/pagination';
import { CredentialInterceptor } from '../interceptors/credential.interceptor';
import { ReportService } from '../services/report.service';

@CastcleController({ path: 'reporting', version: '1.0' })
export class ReportController {
  constructor(private reportService: ReportService) {}

  @UseInterceptors(CredentialInterceptor)
  @Post('')
  @HttpCode(200)
  async getReport(@Body() page: Pagination) {
    return ResponseDto.ok({
      payload: await this.reportService.getReport(page),
    });
  }
}
