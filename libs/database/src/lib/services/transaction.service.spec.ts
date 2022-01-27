/*
 * Filename: /Users/sompop/Projects/castcle-api/libs/database/src/lib/services/transaction.service.spec.tts
 * Path: /Users/sompop/Projects/castcle-api
 * Created Date: Wednesday, January 26th 2022, 10:28:06 am
 * Author: Sompop Kulapalanont
 *
 * Copyright (c) 2022 Your Company
 */

import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { env } from '../environment';
import { User, UserType } from './../schemas/user.schema';
import { TransactionService } from './transaction.service';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('Transaction Service', () => {
  let service: TransactionService;
  let mocksUser: User;
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [TransactionService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<TransactionService>(TransactionService);

    mocksUser = new service._userModel({
      ownerAccount: '61b4a3b3bb19fc8ed04edb8e',
      displayName: 'mock user',
      displayId: 'mockid',
      type: UserType.People,
    });
    await mocksUser.save();
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
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
