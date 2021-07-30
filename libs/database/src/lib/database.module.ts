import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Environment as env } from '@castcle-api/environments';
import { AuthenticationService } from './services/authentication.service';
import { AccountSchema } from './schemas/account.schema';
import { CredentialSchema } from './schemas/credential.schema';
import { AccountActivationSchema } from './schemas/accountActivation.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(env.db_uri, env.db_options),
    MongooseModule.forFeature([
      { name: 'Account', schema: AccountSchema },
      { name: 'Credential', schema: CredentialSchema },
      { name: 'AccountActivation', schema: AccountActivationSchema }
    ])
  ],
  controllers: [],
  providers: [AuthenticationService],
  exports: [AuthenticationService]
})
export class DatabaseModule {}

export { AuthenticationService };
