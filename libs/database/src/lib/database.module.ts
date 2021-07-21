import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Environment as env } from '@castcle-api/environments';

@Global()
@Module({
  imports:[MongooseModule.forRoot( env.db_location )],
  controllers: [],
  providers: [],
  exports: [],
})
export class DatabaseModule {}
