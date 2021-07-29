import { I18nLang, I18nService } from 'nestjs-i18n';

export class Message {
  constructor(private readonly i18n: I18nService) {}

  async getAllErrorMessage(@I18nLang() lang: string) {
    let data = await this.i18n.translate('error', {
      lang: lang
    });
    return data;
  }

  async getErrorMessage(key: string, @I18nLang() lang: string, args: any) {
    let data = await this.i18n.translate('error.' + key, {
      lang: lang,
      args: args
    });
    return data;
  }

  async getCommonMessage(key: string, @I18nLang() lang: string, args: any) {
    let data = await this.i18n.translate('common.' + key, {
      lang: lang,
      args: args
    });
    return data;
  }
}
