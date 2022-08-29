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

import { CastcleImage } from '@castcle-api/utils/aws';
import {
  BlogPayload,
  EntityVisibility,
  ImagePayload,
  Link,
  Metrics,
  Participates,
  ReferencedCast,
  ShortPayload,
} from '../dtos';
import { ContentType } from './content.enum';

export class GetParticipatesPayload {
  liked: boolean;
  recasted: boolean;
  quoted: boolean;
  commented: boolean;
  farmed: boolean;
}

export class GetContentPayload {
  _id: string;
  contentId: string;
  authorId: string;
  payload: ShortPayload | BlogPayload | ImagePayload;
  type: ContentType;
  visibility: EntityVisibility;
  metrics: Metrics;
  originalPost?: GetContentPayload;
  reportedStatus?: string;
  reportedSubject?: string;
  isQuote?: boolean;
  isRecast?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PublicContentResponse {
  id: string;
  authorId: string;
  type: ContentType;
  message: string;
  photo: {
    cover?: CastcleImage;
    contents: CastcleImage[];
  };
  link: Link[];
  referencedCasts?: ReferencedCast;
  metrics: Metrics;
  participate: Participates;
  createdAt: Date;
  updatedAt: Date;
}

export class OwnerContentResponse extends PublicContentResponse {
  reportedStatus?: string;
  reportedSubject?: string;
  visibility?: EntityVisibility;
}
