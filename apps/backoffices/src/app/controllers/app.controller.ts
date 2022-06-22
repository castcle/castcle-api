import { CastcleController } from '@castcle-api/utils/decorators';
import { Get, HttpCode } from '@nestjs/common';
import { AppService } from '../services/app.service';

@CastcleController({ path: 'backoffice', version: '1.0' })
export class AppController {
  constructor(private appService: AppService) {}

  @Get('')
  @HttpCode(200)
  async getBackoffice() {
    return this.appService.getHello();
  }
}
