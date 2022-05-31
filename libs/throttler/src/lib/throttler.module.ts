import { Environment } from '@castcle-api/environments';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CastcleThrottlerGuard } from './throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: Environment.RATE_LIMIT_TTL,
      limit: Environment.RATE_LIMIT_LIMIT,
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: CastcleThrottlerGuard }],
})
export class CastcleThrottlerModule {}
