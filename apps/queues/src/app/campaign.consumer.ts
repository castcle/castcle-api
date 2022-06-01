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

import { CampaignService, QueueName, QueueTopic } from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue as BullQueue, Job } from 'bull';

@Processor(QueueName.CAMPAIGN)
export class CampaignConsumer {
  private logger = new CastLogger(CampaignConsumer.name);

  constructor(
    @InjectQueue(QueueName.CAMPAIGN)
    private campaignQueue: BullQueue<{ queueId: string }>,
    private campaignService: CampaignService,
  ) {
    this.addQueues();
  }

  async addQueues() {
    await this.campaignQueue.empty();

    const queues = await this.campaignService.getRemainingQueues(
      QueueTopic.CLAIM_AIRDROP,
    );

    await this.campaignQueue.addBulk(queues);

    this.logger.log(JSON.stringify(queues), 'addQueues');
  }

  @Process()
  async processClaimAirdropJob(job: Job<{ queueId: string }>) {
    await this.campaignService.processClaimAirdrop(job);
  }
}
