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

import { Abstract, ModuleMetadata, Type } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { TestingModule as NestTestingModule, Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model } from 'mongoose';

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

  async createGuest() {
    const accountModel = this.getModel('Account');
    const account = new accountModel({
      isGuest: true,
      visibility: 'publish',
      'preferences.languages': ['en'],
    });
    const token = await account.regenerate({
      device: 'Castcle',
      deviceUUID: Date.now().toString(),
      platform: 'CastcleOS',
    });

    return {
      _id: account._id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    };
  }

  async createUser(name: string, email = Date.now().toString()) {
    const accountModel = this.getModel('Account');
    const userModel = this.getModel('User');
    const account = new accountModel({
      isGuest: false,
      visibility: 'publish',
      'preferences.languages': ['en'],
      email: `${email}@castcle.com`,
    });
    const [token, user] = await Promise.all([
      account.regenerate({
        device: 'Castcle',
        deviceUUID: Date.now().toString(),
        platform: 'CastcleOS',
      }),
      new userModel({
        type: 'people',
        visibility: 'publish',
        ownerAccount: account._id,
        displayId: name,
        displayName: name,
        email: `${email}@castcle.com`,
      }).save(),
    ]);

    return {
      account: { _id: account._id },
      user: { _id: user._id },
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    };
  }
}
