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

import { UserService } from '../services/user.service';
import { AuthenticationService } from '../services/authentication.service';
import { AccountDocument, CredentialDocument, UserDocument } from '../schemas';
import { PageDto } from '../dtos/user.dto';

type Models = {
  userService: UserService;
  accountService: AuthenticationService;
};

type UserInfo = {
  accountRequirement: {
    device: string;
    deviceUUID: string;
    header: {
      platform: string;
    };
    languagesPreferences: string[];
  };
  signupRequirement: {
    displayId: string;
    displayName: string;
    email: string;
    password: string;
  };
  pages: PageDto[];
};

export type MockUserDetail = {
  account: AccountDocument;
  user: UserDocument;
  pages: UserDocument[];
  credential: CredentialDocument;
};

const _generatePageDto = (pagePerAccountAmount: number) => {
  const pageDtos: PageDto[] = [];
  for (let i = 0; i < pagePerAccountAmount; i++) {
    pageDtos[i] = {
      castcleId: `page-${i}-${new Date().getTime()}`,
      displayName: `Page-${i}`,
    };
  }
  return pageDtos;
};

/**
 * Generate all info needed to create users
 * @param userAccountAmount
 * @param pagePerAccountAmount
 * @returns {UserInfo[]}
 */
const _generateUserInfos = (
  userAccountAmount: number,
  pagePerAccountAmount: number
) => {
  const userInfos: UserInfo[] = [];
  for (let i = 0; i < userAccountAmount; i++) {
    userInfos[i] = {
      accountRequirement: {
        device: 'mock',
        deviceUUID: `mock-${Math.ceil(Math.random() * 10000)}-${i}`,
        header: {
          platform: 'mock-os',
        },
        languagesPreferences: ['th', 'th'],
      },
      signupRequirement: {
        displayId: `mock-${i}-${new Date().getTime()}`,
        displayName: `Mock-${i}`,
        email: `mock-${i}-${new Date().getTime()}@mockna.com`,
        password: '2@HelloWorld',
      },
      pages: _generatePageDto(pagePerAccountAmount),
    };
  }
  return userInfos;
};

export const generateMockUsers = async (
  userAccountAmount: number,
  pagePerAccountAmount: number,
  model: Models
) => {
  const userInfos = _generateUserInfos(userAccountAmount, pagePerAccountAmount);
  const mockUsers: MockUserDetail[] = [];

  for (let j = 0; j < userInfos.length; j++) {
    const info = userInfos[j];
    const result = await model.accountService.createAccount(
      info.accountRequirement
    );
    const accountActivation = await model.accountService.signupByEmail(
      result.accountDocument,
      info.signupRequirement
    );
    const verifyAcc = await model.accountService.verifyAccount(
      accountActivation
    );
    const user = await model.accountService.getUserFromCastcleId(
      info.signupRequirement.displayId
    );

    const pages: UserDocument[] = [];
    for (let i = 0; i < info.pages.length; i++) {
      pages.push(
        await model.userService.createPageFromUser(user, info.pages[i])
      );
    }
    mockUsers.push({
      account: verifyAcc,
      user: user,
      pages: pages,
      credential: result.credentialDocument,
    });
  }
  return mockUsers;
};
