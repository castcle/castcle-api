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
import {
  BlogPayload,
  ContentType,
  SaveContentDto,
  Url,
} from '@castcle-api/database/dtos';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { Image, COMMON_SIZE_CONFIGS } from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';
import { UserDocument } from '@castcle-api/database/schemas';

@Injectable()
export class AppService {
  constructor(private authService: AuthenticationService) {}

  /**
   * return user document that has same castcleId but check if this request should have access to that user
   * @param {CredentialRequest} credentialRequest
   * @param {string} castcleId
   * @returns {UserDocument}
   */
  async getUserFromBody(
    credentialRequest: CredentialRequest,
    castcleId: string
  ) {
    const account = await this.authService.getAccountFromCredential(
      credentialRequest.$credential
    );
    const user = await this.authService.getUserFromCastcleId(castcleId);
    if (String(user.ownerAccount) !== String(account._id)) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        credentialRequest.$language
      );
    }
    return user;
  }

  /**
   * Upload photo content to s3
   * @param {SaveContentDto} body
   * @returns {SaveContentDto} body
   */
  async uploadContentToS3(body: SaveContentDto, uploader: UserDocument) {
    if (body.payload.photo && body.payload.photo.contents) {
      const newContents = await Promise.all(
        (body.payload.photo.contents as Url[]).map(async (item) => {
          console.debug('uploading----');
          console.debug(item);
          return Image.upload(item.image, {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${uploader._id}`,
          }).then((r) => r.image);
        })
      );
      body.payload.photo.contents = newContents;
      console.debug('photo contents', newContents);
    }
    if (
      body.type === ContentType.Blog &&
      (body.payload as BlogPayload).photo.cover
    ) {
      (body.payload as BlogPayload).photo.cover = (
        await Image.upload(
          ((body.payload as BlogPayload).photo.cover as Url).image,
          {
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${uploader._id}`,
          }
        )
      ).image;
    }
    return body;
  }
}
