import { HttpException } from "@nestjs/common/exceptions";
import { Message } from "@castcle-api/message";
import { I18nService } from 'nestjs-i18n';

export class CastcleException extends HttpException {
  private static errorMessages: any;

  static async init(i18n: I18nService){
    let message = new Message(i18n);
    CastcleException.errorMessages = await message.getAllErrorMessage('en');
  }

  constructor(key:string){
    super(
      {
        status: CastcleException.errorMessages[key]['statusCode'],
        error: CastcleException.errorMessages[key]['message'],
      }, CastcleException.errorMessages[key]['statusCode']
    );
  }
}
