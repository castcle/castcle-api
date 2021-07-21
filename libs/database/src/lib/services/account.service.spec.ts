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

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountService } from "./account.service"

import { Environment as env } from '@castcle-api/environments';
import { AccountDocument, AccountSchema } from "../schemas/account.schema"
import { CredentialSchema } from "../schemas/credential.schema"


describe('AccountService', () => {
    let service:AccountService
    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot( env.db_location),
                MongooseModule.forFeature([ {name: 'Account', schema: AccountSchema}, {name:'Credential', schema:CredentialSchema}])
            ],
            providers:[AccountService],
        }).compile()
        service = module.get<AccountService>(AccountService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    })
    describe('Onboarding', () => {
        let createdDocument
        describe('Create account flow', () => {
            it('should create a credential when create an account',async () => {
                createdDocument = await service.create({
                    isGuest:true,
                    createDate:new Date(),
                    updateDate:new Date(),
                    preferences:{languages:["en", "en"]}
                })
                expect(createdDocument.account).toBeDefined();
                expect(createdDocument.credential).toBeDefined();
                expect(createdDocument.credential.accessToken).toBeDefined()
                
            })
        })
        



    })
    
});