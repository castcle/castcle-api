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

import { CastcleLogger } from '@castcle-api/common';
import {
  ContentMessage,
  ContentMessageEvent,
  ContentServiceV2,
  DataService,
  QueueName,
} from '@castcle-api/database';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor(QueueName.CONTENT)
export class ContentConsumer {
  #logger = new CastcleLogger(ContentConsumer.name);

  constructor(
    private contentService: ContentServiceV2,
    private dataService: DataService,
  ) {}

  @Process()
  async handleContentMessage({ data, id }: Job<ContentMessage>) {
    try {
      this.#logger.log(JSON.stringify(data), `handleContentMessage:${id}`);

      if (data.event === ContentMessageEvent.NEW_CONTENT) {
        await this.#detectContent(data.contentId);
      }
    } catch (error) {
      this.#logger.error(error, `handleContentMessage:${id}`);
    }
  }

  #detectContent = async (contentId: string) => {
    const dsIllegal = await this.dataService.detectContent(contentId);
    await this.contentService.contentFlowIllegal(contentId, dsIllegal);
  };
}
