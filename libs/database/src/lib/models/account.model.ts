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

import { AcceptPlatform } from '../dtos';
import { AuthenticationProvider } from './account.enum';

export class AccountAuthentication {
  socialId: string;
  socialToken?: string;
  avatar?: string;
}

export type AccountAuthentications = Partial<
  Record<AuthenticationProvider, AccountAuthentication>
>;

export enum AccountActivationType {
  EMAIL = 'email',
  PHONE = 'phone',
}

export class AccountActivation {
  type: AccountActivationType;
  verifyToken: string;
  verifyTokenExpireDate: Date;
  activationDate?: Date;
  revocationDate?: Date;
}

export class AccountCampaigns {
  [campaignId: string]: Date[];
}

export class AccountDevice {
  uuid: string;
  firebaseToken: string;
  platform: AcceptPlatform;
}

export interface AccountRequirements {
  header: {
    platform: string;
  };
  device: string;
  deviceUUID: string;
  languagesPreferences: string[];
  geolocation?: {
    countryCode: string;
    continentCode: string;
  };
}
export class AcceptDatePDPA {
  [key: string]: boolean;
}
