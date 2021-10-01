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
import { AuthenticationService } from '@castcle-api/database';
import { Environment as env } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Password } from '@castcle-api/utils';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { CredentialDocument } from './../../../../libs/database/src/lib/schemas/credential.schema';
import { getSignupHtml } from './configs/signupEmail';
import { SocialConnect, TokenResponse } from './dtos/dto';
/*
 * TODO: !!!
 */
const transporter = nodemailer.createTransport({
  host: env.smtp_host ? env.smtp_host : 'http://localhost:3334',
  port: env.smtp_port ? env.smtp_port : 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: env.smtp_username ? env.smtp_username : 'username', // generated ethereal user
    pass: env.smtp_password ? env.smtp_password : 'password' // generated ethereal password
  }
});

@Injectable()
export class AppService {
  constructor(private authService: AuthenticationService) {}

  private readonly logger = new CastLogger(AppService.name, CastLoggerOptions);

  getData(): { message: string } {
    return { message: 'Welcome to authentications!' };
  }

  async sendRegistrationEmail(hostname: string, toEmail: string, code: string) {
    const verifyLink = `${hostname}/authentications/verify`;
    const info = await transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: 'Welcome to Castcle',
      to: toEmail,
      text: `Welcome to castcle here is a link embed code ${verifyLink}?code=${code}`,
      html: getSignupHtml(
        toEmail,
        `${verifyLink}?code=${code}`,
        'admin@castcle.com'
      )
    });
    console.log(`Email is send `, info.messageId, info);
  }

  /**
   * Validate if password pass Password.validate() if not will throw CastcleException
   * @param password
   * @param langagues en is default
   * @returns {boolean}
   */
  validatePassword(password: string, langagues?: string) {
    if (Password.validate(password)) return true;
    else {
      throw new CastcleException(CastcleStatus.INVALID_PASSWORD, langagues);
    }
  }

  /**
   * Create user and generate token for login social
   * @param social social response
   * @param credential
   * @returns {TokenResponse}
   */
  async socailLogin(social: SocialConnect, credential: CredentialDocument) {
    const currentAccount = await this.authService.getAccountFromCredential(
      credential
    );

    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      social.socialId,
      social.provider
    );

    const user = await this.authService.getUserFromAccountId(credential);
    if (!socialAccount) {
      currentAccount.email = currentAccount.email
        ? social.email
        : currentAccount.email;
      if (!user) {
        const accountActivation = await this.authService.signupBySocial(
          currentAccount,
          {
            displayName: social.name,
            socialId: social.socialId,
            provider: social.provider
          }
        );
      } else {
        await this.authService.createAccountAuthenId(
          currentAccount,
          social.provider,
          social.socialId
        );
      }
    }

    credential.account.isGuest = false;
    const accessTokenPayload =
      await this.authService.getAccessTokenPayloadFromCredential(credential);
    const tokenResult: TokenResponse = await credential.renewTokens(
      accessTokenPayload,
      {
        id: currentAccount._id as unknown as string,
        role: 'member'
      }
    );
    return tokenResult;
  }
}
