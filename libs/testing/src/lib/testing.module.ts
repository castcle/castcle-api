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

import { getQueueToken } from '@nestjs/bull';
import { Abstract, ModuleMetadata, Type } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { TestingModule as NestTestingModule, Test } from '@nestjs/testing';
import { Queue } from 'bull';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { CreatedUser } from './testing.dto';

export class TestingModule {
  constructor(
    private moduleRef: NestTestingModule,
    private mongoMemoryServer?: MongoMemoryReplSet,
  ) {}

  static async create(metadata: ModuleMetadata) {
    const moduleRef = await Test.createTestingModule(metadata).compile();
    return new TestingModule(moduleRef);
  }

  static async createWithDb(metadata: ModuleMetadata) {
    const mongoMemoryServer = await MongoMemoryReplSet.create();
    global.mongoUri = mongoMemoryServer.getUri();
    const moduleRef = await Test.createTestingModule(metadata).compile();
    return new TestingModule(moduleRef, mongoMemoryServer);
  }

  cleanDb() {
    const modelConnection = this.moduleRef.get(getConnectionToken()).models;
    const models = Object.values<Model<any>>(modelConnection);
    return Promise.all(models.map((model) => model.deleteMany()));
  }

  close() {
    return Promise.all([
      this.moduleRef.close(),
      this.mongoMemoryServer?.stop({ doCleanup: true, force: true }),
    ]);
  }

  get<T = any>(typeOrToken: Type<T> | Abstract<T>): T | undefined {
    return this.moduleRef.get<T>(typeOrToken);
  }

  getModel<T = any>(typeOrToken: string): Model<T> {
    return this.moduleRef.get<any, Model<T>>(getModelToken(typeOrToken));
  }

  getQueue<T = any>(typeOrToken: string): Queue<T> {
    return this.moduleRef.get<any, Queue<T>>(getQueueToken(typeOrToken));
  }

  async createGuest() {
    const deviceUUID = nanoid();
    const accountModel = this.getModel('Account');
    const account = new accountModel({
      isGuest: true,
      visibility: 'publish',
      'preferences.languages': ['en'],
      credentials: [
        {
          device: 'Castcle',
          deviceUUID,
          platform: 'CastcleOS',
        },
      ],
    });
    const token = await account.regenerateToken({ deviceUUID });

    return {
      _id: account._id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    };
  }

  async createUsers(count: number) {
    return Promise.all(Array.from({ length: count }, () => this.createUser()));
  }

  async createUser(dto?: {
    castcleId?: string;
    pageSize?: number;
    referrer?: Types.ObjectId;
  }): Promise<CreatedUser> {
    const castcleId = dto?.castcleId || `user-${nanoid()}`;
    const accountModel = this.getModel('Account');
    const userModel = this.getModel('User');
    const account = new accountModel({
      isGuest: false,
      visibility: 'publish',
      'preferences.languages': ['en'],
      email: `${castcleId}@castcle.com`,
      activateDate: new Date(),
      credentials: [
        {
          device: 'Castcle',
          deviceUUID: castcleId,
          platform: 'CastcleOS',
        },
      ],
      referralBy: dto?.referrer,
    });
    const [token, user, ...pages] = await Promise.all([
      account.regenerateToken({ deviceUUID: castcleId }),
      new userModel({
        type: 'people',
        visibility: 'publish',
        ownerAccount: account._id,
        displayId: castcleId,
        displayName: castcleId,
        email: `${castcleId}@castcle.com`,
      }).save(),
      ...(dto?.pageSize
        ? Array.from({ length: dto.pageSize }, () =>
            new userModel({
              type: 'page',
              visibility: 'publish',
              ownerAccount: account._id,
              displayId: `page-${nanoid()}`,
              displayName: `page-${nanoid()}`,
              email: `${castcleId}@castcle.com`,
            }).save(),
          )
        : []),
    ]);

    return {
      account,
      user,
      pages,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    };
  }

  deposit(userId: Types.ObjectId, amount: number) {
    const txModel = this.getModel('Transaction');
    return new txModel({
      from: {
        type: 'external.deposit',
        value: amount,
      },
      to: [
        {
          user: userId,
          type: 'personal',
          value: amount,
        },
      ],
      type: 'deposit',
      status: 'verified',
    }).save();
  }
}
