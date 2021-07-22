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
import { AuthenticationService } from "./authentication.service"

import { Environment as env } from '@castcle-api/environments';
import { AccountDocument, AccountSchema } from "../schemas/account.schema"
import { CredentialSchema } from "../schemas/credential.schema"


describe('Authentication Service', () => {
    let service:AuthenticationService
    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot( env.db_location),
                MongooseModule.forFeature([ {name: 'Account', schema: AccountSchema}, {name:'Credential', schema:CredentialSchema}])
            ],
            providers:[AuthenticationService],
        }).compile()
        service = module.get<AuthenticationService>(AuthenticationService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    })
    describe('Onboarding', () => {
        let createdDocument
        describe('#generateAccessToken()', () => {
            it('should return accountId, acessToken, refreshToken, accessTokenExpireDate and refreshTokenExpireDate', () => {

            })
            it('should generate an account if there is no deviceUUID in credentials\'s collection that call this function', () => {

            })
            it('should not generate an account if account with deviceUUID is already exist', () => {

            })
        })

        describe('#verifyAccessToken()', () => {
            it('should return true if accessToken is valid ', () => {

            })
            it('should return false if accessToken is invalid ', () => {
                
            })
            it('should return false if accessToken is expire ', () => {
                
            })
        })

        describe('#refreshAccessToken()', () => {
            it('should return accessToken if refreshToken is valid ', () => {

            })
            it('should return false if accessToken is invalid ', () => {
                
            })
            it('should return false if accessToken is expire ', () => {
                
            })
        })

        describe('#createAccountWithEmail()', () => {
            it('should create AccountActivation if accessToken is valid', () => {

            })
            it('should return  AccountActivation if accessToken is valid', () => {
                
            })
            it('should return  null if accessToken is invalid', () => {
                
            })
        })

        describe('#verifyAccountWithEmail()', () => {
            it('should update an Account if verifyToken is valid', () => {

            })
            it('should return  Account if function run sucessfully', () => {
                
            })
            it('should return  null if verifyToken is invalid', () => {
                
            })
        })

        describe('#loginWithEmail()', () => {
            it('should update an Account if verifyToken is valid', () => {

            })
            it('should return  Account if function run sucessfully', () => {
                
            })
            it('should return  null if verifyToken is invalid', () => {
                
            })
        })


    })
    
}); 