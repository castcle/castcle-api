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

import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Environment as env } from '@castcle-api/environments';
/*
 * TODO: !!!
 */
const currentHosting = `http://localhost:3334`;
const transporter = nodemailer.createTransport({
  host: env.smtp_host,
  port: env.smtp_port,
  secure: true, // true for 465, false for other ports
  auth: {
    user: env.smtp_username, // generated ethereal user
    pass: env.smtp_password // generated ethereal password
  }
});

@Injectable()
export class AppService {
  getData(): { message: string } {
    return { message: 'Welcome to authentications!' };
  }

  async sendRegistrationEmail(toEmail: string, code: string) {
    const info = await transporter.sendMail({
      from: 'No Reply" <no-reply@castcle.com>',
      subject: 'Welcome to Castcle',
      to: toEmail,
      text: `Welcome to castcle here is a link embed code ${currentHosting}/testLink?code=${code}`,
      html: `Welcome to castcle here is a link embed code ${currentHosting}/testLink?code=${code}`
    });
    console.log(`Email is send `, info.messageId, info);
  }
}
