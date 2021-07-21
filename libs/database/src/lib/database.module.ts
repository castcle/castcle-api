import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { environment} from "../environments/environment"

@Global()
@Module({
  imports:[MongooseModule.forRoot(environment.dbLocation)],
  controllers: [],
  providers: [],
  exports: [],
})
export class DatabaseModule {}
