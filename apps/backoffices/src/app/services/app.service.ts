import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getReport() {
    return 'Hello';
  }
}
