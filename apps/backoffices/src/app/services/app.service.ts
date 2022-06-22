import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return { payload: 'hello backoffice' };
  }
}
