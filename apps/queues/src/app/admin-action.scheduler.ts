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

import { Queue, QueueStatus, TAccountService } from '@castcle-api/database';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

@Injectable()
export class AdminScheduler {
  constructor(
    @InjectModel('Queue') private queue: Model<Queue>,
    private taccountService: TAccountService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async executeUnprocessQueue() {
    const actionQueues = await this.queue.find({
      'payload.action': 'topup-token',
      status: QueueStatus.WAITING,
    });
    if (!actionQueues) return;
    for (let i = 0; i < actionQueues.length; i++) {
      const actionQ = actionQueues[i];
      try {
        await this.taccountService.topUp(actionQ.payload.data);
        actionQ.status = QueueStatus.DONE;
      } catch (e) {
        actionQ.status = QueueStatus.FAILED;
      }
      await actionQ.save();
    }
  }
}
