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
import { CastLogger } from '@castcle-api/logger';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { TopicName } from '../enum/topic.name';
import { UserMessage } from '../messages/user.message';
@Injectable()
export class UserProducer {
  private logger = new CastLogger(UserProducer.name);

  constructor(@InjectQueue(TopicName.Users) private queue: Queue) {}

  /**
   * send user message to queue !!! if action === Deactivate send account id instead of user id
   * @param {UserMessage} UserMessage user message
   * @returns {}
   */
  async sendMessage(message: UserMessage) {
    await this.queue.add({
      user: message,
    });
    this.logger.log(`produce message '${JSON.stringify(message)}' `);
  }
}
