/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */
import { Module, Global } from '@nestjs/common';
import {
  getModelToken,
  MongooseModule,
  MongooseModuleOptions
} from '@nestjs/mongoose';
import { env } from './environment';
import { AuthenticationService } from './services/authentication.service';
import { UserService } from './services/user.service';
import { ContentService } from './services/content.service';
import { AccountSchema, AccountSchemaFactory } from './schemas/account.schema';
import {
  CredentialSchema,
  CredentialSchemaFactory
} from './schemas/credential.schema';
import { AccountActivationSchema } from './schemas/accountActivation.schema';
import { UserSchema } from './schemas/user.schema';
import { ContentSchema } from './schemas/content.schema';

export const MongooseForFeatures = MongooseModule.forFeature([
  { name: 'AccountActivation', schema: AccountActivationSchema },
  { name: 'User', schema: UserSchema },
  { name: 'Content', schema: ContentSchema }
]);

export const MongooseAsyncFeatures = MongooseModule.forFeatureAsync([
  { name: 'Credential', useFactory: CredentialSchemaFactory },
  {
    name: 'Account',
    useFactory: AccountSchemaFactory,
    inject: [getModelToken('Credential')]
  }
]);

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(env.db_uri, env.db_options),
    MongooseAsyncFeatures,
    MongooseForFeatures
  ],
  controllers: [],
  providers: [AuthenticationService, UserService, ContentService],
  exports: [AuthenticationService, UserService, ContentService]
})
export class DatabaseModule {}

export { AuthenticationService, UserService, ContentService };
