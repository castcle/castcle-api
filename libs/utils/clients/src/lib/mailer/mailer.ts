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

import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { getRegistrationHtml } from './templates/registration';

@Injectable()
export class Mailer {
  private logger = new CastLogger(Mailer.name);
  private transporter = createTransport({
    host: Environment.SMTP_HOST,
    port: Environment.SMTP_PORT,
    secure: true,
    auth: {
      user: Environment.SMTP_USERNAME,
      pass: Environment.SMTP_PASSWORD,
    },
  });

  async sendRegistrationEmail(hostname: string, toEmail: string, code: string) {
    try {
      const verifyLink = `${hostname}/authentications/verify`;
      const info = await this.transporter.sendMail({
        from: 'castcle-noreply" <no-reply@castcle.com>',
        subject: 'Welcome to Castcle',
        to: toEmail,
        text: `Welcome to castcle here is a link embed code ${verifyLink}?code=${code}`,
        html: getRegistrationHtml(
          toEmail,
          `${verifyLink}?code=${code}`,
          Environment.SMTP_ADMIN_EMAIL || 'admin@castcle.com',
        ),
      });

      this.logger.log(`Email is send ${info.messageId} ${info}`);
    } catch (error) {
      this.logger.error(error, `sendRegistrationEmail:${toEmail}`);
    }
  }
}
