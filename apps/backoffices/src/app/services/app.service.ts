import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor() {}

  getReport() {
    return 'Hello';
  }
}
