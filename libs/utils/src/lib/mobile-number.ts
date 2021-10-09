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

import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import PhoneNumber from 'awesome-phonenumber';

const combineMobileNumber = async (
  countryCode: string,
  mobileNo: string
): Promise<string> => {
  const pn = await new PhoneNumber(mobileNo, countryCode);
  if (pn.isValid && pn.isMobile) {
    return pn.getNumber();
  } else {
    throw new CastcleException(CastcleStatus.INVALID_PHONE_NUMBER);
  }
};

const getMobileNoWithCountyrCode = async (
  countryCode: string,
  mobileNo: string
): Promise<string> => {
  try {
    const stringCountryCode = await PhoneNumber.getRegionCodeForCountryCode(
      parseInt(countryCode.replace('+', ''))
    );
    return await combineMobileNumber(stringCountryCode, mobileNo);
  } catch (e) {
    throw new CastcleException(CastcleStatus.INVALID_PHONE_NUMBER);
  }
};

export const MobileNumber = { combineMobileNumber, getMobileNoWithCountyrCode };
