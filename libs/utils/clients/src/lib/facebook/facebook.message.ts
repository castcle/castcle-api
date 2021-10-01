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

export interface FacebookUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  picture: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    };
  };
  email: string;
  name: string;
}

// "error": {
//     "message": "Error validating access token: Session has expired on Wednesday, 29-Sep-21 03:00:00 PDT. The current time is Wednesday, 29-Sep-21 07:59:52 PDT.",
//     "type": "OAuthException",
//     "code": 190,
//     "error_subcode": 463,
//     "fbtrace_id": "AgO7b3885hWlu0wVKMBvwTJ"
// }

export interface FacebookAccessToken {
  access_token: string;
  token_type: string;
}

export interface FacebookTokenData {
  app_id: string;
  type: string;
  application: string;
  data_access_expires_at: number;
  error: {
    code: number;
    message: string;
    subcode: number;
  };
  expires_at: number;
  is_valid: boolean;
  scopes: string[];
  user_id: string;
}

// {
//     "data": {
//         "app_id": "210809024158044",
//         "type": "USER",
//         "application": "Castcle - DEV",
//         "data_access_expires_at": 1640678418,
//         "error": {
//             "code": 190,
//             "message": "Error validating access token: Session has expired on Wednesday, 29-Sep-21 03:00:00 PDT. The current time is Wednesday, 29-Sep-21 05:49:17 PDT.",
//             "subcode": 463
//         },
//         "expires_at": 1632909600,
//         "is_valid": false,
//         "scopes": [
//             "public_profile"
//         ],
//         "user_id": "10159318238764223"
//     }
// }
