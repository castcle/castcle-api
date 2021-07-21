import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Environment as env } from '@castcle-api/environments';

@Global()
@Module({
  imports:[MongooseModule.forRoot( `mongodb://${env.db_host}/${env.db_database_name}`)],
  controllers: [],
  providers: [],
  exports: [],
})
export class DatabaseModule {}
