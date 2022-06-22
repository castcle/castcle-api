import { CastcleController } from '@castcle-api/utils/decorators';
import { Get, HttpCode } from '@nestjs/common';

@CastcleController({ path: 'backoffice', version: '1.0' })
export class AppController {
  @Get('')
  @HttpCode(200)
  async getBackoffice() {
    return { payload: 'Hello Backoffice' };
  }
}
