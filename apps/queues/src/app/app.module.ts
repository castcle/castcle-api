import {
  CampaignService,
  getBullModuleOptions,
  getMongooseModuleOptions,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  QueueName,
  TAccountService,
} from '@castcle-api/database';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignConsumer } from './campaign.consumer';
import { CampaignScheduler } from './campaign.scheduler';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => getBullModuleOptions(),
    }),
    BullModule.registerQueue(
      { name: QueueName.CONTENT },
      { name: QueueName.CAMPAIGN }
    ),
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseModuleOptions(),
    }),
    MongooseAsyncFeatures,
    MongooseForFeatures,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [
    CampaignConsumer,
    CampaignScheduler,
    CampaignService,
    TAccountService,
  ],
})
export class AppModule {}
