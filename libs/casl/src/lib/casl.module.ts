import { Module } from '@nestjs/common';
import { DatabaseModule } from '@castcle-api/database';
import {
  Action,
  AppAbility,
  CaslAbilityFactory,
} from './abilities/abilities.factory';
import { PolicyHandler } from './policies';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}

export { CaslAbilityFactory, PolicyHandler, AppAbility, Action };
