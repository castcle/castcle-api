/*
 * Filename: /Users/sompop/Projects/castcle-api/libs/database/src/lib/services/transaction.service.spec.tts
 * Path: /Users/sompop/Projects/castcle-api
 * Created Date: Wednesday, January 26th 2022, 10:28:06 am
 * Author: Sompop Kulapalanont
 *
 * Copyright (c) 2022 Your Company
 */

import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { User, UserType } from './../schemas/user.schema';
import { TransactionService } from './transaction.service';

describe('Transaction Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: TransactionService;
  let mocksUser: User;

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

    mocksUser = new service._userModel({
      ownerAccount: '61b4a3b3bb19fc8ed04edb8e',
      displayName: 'mock user',
      displayId: 'mockid',
      type: UserType.People,
    });
    await mocksUser.save();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('should create new transaction from transfer()', async () => {
    const createResult = await service.transfer({
      to: String(mocksUser.ownerAccount._id),
      value: 10,
    });
    expect(createResult.value).toEqual(10);
    expect(createResult.createdAt).toBeDefined();
  });
  it('should have 10 and 5 balance', async () => {
    const currentTransaction = await service._transactionModel
      .findOne({ to: String(mocksUser.ownerAccount._id) })
      .exec();
    expect(currentTransaction.value).toEqual(10);
    const initBalance = await service.getUserBalance(mocksUser);
    expect(initBalance).toEqual(10);
    await service.transfer({
      from: String(mocksUser.ownerAccount._id),
      value: 5,
    });
    const afterBalance = await service.getUserBalance(mocksUser);
    expect(afterBalance).toEqual(5);
  });
});
