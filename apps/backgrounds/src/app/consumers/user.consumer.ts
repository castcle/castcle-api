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
  CastcleQueueAction,
  Comment,
  Content,
  QueueName,
  User,
  UserMessage,
} from '@castcle-api/database';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';

@Injectable()
@Processor(QueueName.USER)
export class UserConsumer {
  private logger = new CastcleLogger(UserConsumer.name);

  constructor(
    @InjectModel('Content') private contentModel: Model<Content>,
    @InjectModel('Comment') private commentModel: Model<Comment>,
    @InjectModel('User') private userModel: Model<User>,
  ) {}

  @Process()
  async readOperationJob(job: Job<UserMessage>) {
    try {
      this.logger.log(`consume user message '${JSON.stringify(job.data)}' `);

      if (job.data.action === CastcleQueueAction.UpdateProfile) {
        await this.updateEmbeddedUsers(job.data.id);
        this.logger.log(`Updating profile of user ${job.data.id}`);
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async updateEmbeddedUsers(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    await Promise.all([
      this.contentModel
        .updateMany({ 'author.id': user._id }, { author: user.toAuthor() })
        .exec(),
      this.commentModel
        .updateMany({ 'author._id': user._id }, { author: user })
        .exec(),
    ]);
  }
}
