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

import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { ContentMessage, TopicName } from '@castcle-api/utils/queue';
import { ContentService } from '@castcle-api/database';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { CastcleQueueAction } from '@castcle-api/database/dtos';
import { Environment } from '@castcle-api/environments';
@Injectable()
@Processor(TopicName.Contents)
export class ContentConsumer {
  constructor(private contentService: ContentService) {}

  private readonly logger = new CastLogger(
    ContentConsumer.name,
    CastLoggerOptions
  );

  @Process()
  readOperationJob(job: Job<{ content: ContentMessage }>) {
    try {
      this.logger.log(
        `consume content message '${JSON.stringify(job.data.content)}}' `
      );
      //this.userService.deactiveQueue();
      switch (job.data.content.action) {
        case CastcleQueueAction.CreateFeedItemToEveryOne:
          if (Environment.AUTO_CREATE_GUEST_FEED) {
            this.contentService.createGuestFeedItemFromAuthorId(
              job.data.content.id
            );
            this.logger.log(`Creating Feedd Item for all guests`);
          }
          break;
      }
    } catch (error) {
      this.logger.error(error);
    }
  }
}
