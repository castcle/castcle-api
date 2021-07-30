/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */

import { I18nJsonParser, I18nLang, I18nService } from 'nestjs-i18n';

export const i18n_options = {
  fallbackLanguage: 'en',
  parser: I18nJsonParser,
  parserOptions: {
    path: 'libs/message/src/i18n/'
  }
};

export class Message {
  constructor(private readonly i18n: I18nService) {}

  async getAllErrorMessage(@I18nLang() lang: string) {
    const data = await this.i18n.translate('error', {
      lang: lang
    });
    return data;
  }

  async getErrorMessage(key: string, @I18nLang() lang: string, args: any) {
    const data = await this.i18n.translate('error.' + key, {
      lang: lang,
      args: args
    });
    return data;
  }

  async getCommonMessage(key: string, @I18nLang() lang: string, args: any) {
    const data = await this.i18n.translate('common.' + key, {
      lang: lang,
      args: args
    });
    return data;
  }
}
