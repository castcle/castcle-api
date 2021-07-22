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
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { AuthenticationService } from "./authentication.service"

import { Environment as env } from '@castcle-api/environments';
import { Account, AccountDocument, AccountSchema } from "../schemas/account.schema"
import { CredentialDocument, CredentialSchema } from "../schemas/credential.schema"


describe('Authentication Service', () => {
    let service:AuthenticationService
    
    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot( env.db_location),
                MongooseModule.forFeature([ {name: 'Account', schema: AccountSchema}, {name:'Credential', schema:CredentialSchema}])
            ],
            providers:[],
        }).compile()
        service = module.get<AuthenticationService>(AuthenticationService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    })
    describe('Onboarding', () => {
        let createdDocument
        describe('#_generateAccessToken()', () => {
            it('should return accountId, acessToken, refreshToken, accessTokenExpireDate and refreshTokenExpireDate', () => {
                const now = new Date();
                const result = service._generateAccessToken({
                    AcceptVersion:'v1'
                }, {
                    deviceUUID : 'blablabla',
                    device:'testIphone'
                })

                expect(result.accessToken).toBeDefined()
                expect(typeof result.accessToken).toBe("string")
                expect(result.refreshToken).toBeDefined()
                expect(typeof result.refreshToken).toBe("string")
                expect( result.accessTokenExpireDate).toBeDefined()
                expect( result.refreshTokenExpireDate).toBeDefined()
            })
        })

        describe('#createAccount()', () => {
            let createAccountResult:{accountDocument:AccountDocument, credentialDocument:CredentialDocument};
            let accountDocumentCountBefore:number;
            let credentialDocumentCountBefore:number;
            beforeAll(async () => {
                accountDocumentCountBefore =  await service._accountModel.countDocuments().exec();
                credentialDocumentCountBefore = await service._credentialModel.countDocuments().exec();
                createAccountResult  = await service.createAccount({
                    device:"iPhone01",
                    deviceUUID:"68b696d7-320b-4402-a412-d9cee10fc6a3",
                    languagesPreferences:["en", "en"],
                    header:{
                        platform:"iOs"
                    }
                })
            })

            it('should create a new Account ', async () => {
                expect(createAccountResult.accountDocument).toBeDefined();
                const currentAccountDocumentCount  = await service._accountModel.countDocuments().exec();
                expect(currentAccountDocumentCount - accountDocumentCountBefore).toBe(1);
            })
            it('should create a new Credential with account from above', () => {
                expect(createAccountResult.credentialDocument).toBeDefined();
                expect(createAccountResult.credentialDocument.account).toEqual(createAccountResult.accountDocument._id)//not sure how to  check
            })
            it('should create documents with all required properties', () => {
                //check account
                expect(createAccountResult.accountDocument.isGuest).toBeDefined()
                expect(createAccountResult.accountDocument.preferences).toBeDefined()
                expect(createAccountResult.accountDocument).toBeDefined()
                //expect(createAccountResult.accountDocument.updateDate).toBeDefined()
                //check credential
                expect(createAccountResult.credentialDocument.accessToken).toBeDefined()
                expect(createAccountResult.credentialDocument.accessTokenExpireDate).toBeDefined()
                expect(createAccountResult.credentialDocument.refreshToken).toBeDefined()
                expect(createAccountResult.credentialDocument.refreshTokenExpireDate).toBeDefined()
                //expect(createAccountResult.credentialDocument.createDate).toBeDefined()
                //expect(createAccountResult.credentialDocument.updateDate).toBeDefined()
            })
            it('newly created Account should be guest', () => {
                expect(createAccountResult.accountDocument.isGuest).toBe(true);
            })
            it('should contain all valid tokens', () => {
                expect(createAccountResult.credentialDocument.isAccessTokenValid()).toBe(true)
                expect(createAccountResult.credentialDocument.isRefreshTokenValid()).toBe(true)
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
