import { DatabaseModule } from '@castcle-api/database';
import { UtilsQueueModule } from '@castcle-api/utils/queue';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignConsumer } from './campaign.consumer';
import { CampaignScheduler } from './campaign.scheduler';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), UtilsQueueModule],
  controllers: [],
  providers: [CampaignConsumer, CampaignScheduler],
})
export class AppModule {}
