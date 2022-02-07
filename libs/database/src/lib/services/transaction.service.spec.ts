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

import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { Transaction, User } from '../schemas';
import { TransactionService } from './transaction.service';

describe('Transaction Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: TransactionService;
  let transactionModel: Model<Transaction>;
  const accountId = Types.ObjectId();
  const user = { ownerAccount: accountId } as unknown as User;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri(), {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false,
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [TransactionService],
    }).compile();

    service = app.get<TransactionService>(TransactionService);
    transactionModel = (service as any).transactionModel;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('should create new transaction from transfer()', async () => {
    const createResult = await new transactionModel({
      to: { account: accountId },
      value: 10,
    }).save();

    expect(createResult.value.toString()).toEqual('10');
    expect(createResult.createdAt).toBeDefined();
  });

  it('should have 10 and 5 balance', async () => {
    const transaction = await transactionModel.findOne({
      'to.account': accountId,
    });

    expect(transaction.value).toEqual(10);

    await expect(service.getUserBalance(user)).resolves.toEqual(10);

    await new transactionModel({
      from: { account: user.ownerAccount },
      value: 5,
    }).save();

    await expect(service.getUserBalance(user)).resolves.toEqual(5);
  });
});
