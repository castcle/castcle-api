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
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AccountDocument, Account } from '../schemas/account.schema';
import * as mongoose from 'mongoose';
import { CredentialDocument } from "../schemas/credential.schema"
import { CreateAccountDto } from "../dtos/account.dto"

@Injectable()
export class AuthenticationService {
    constructor(@InjectModel('Account') public accountModel:Model<AccountDocument>, @InjectModel('Credential') public credentialModel:Model<CredentialDocument> ){}

    async create(createAccountDto:CreateAccountDto){
        const createdAccount = new this.accountModel(createAccountDto);
        const resultSavedCreatedAccount = await createdAccount.save();
        const createdCredential = new this.credentialModel({
            account: mongoose.Types.ObjectId(resultSavedCreatedAccount._id),
            accessToken: "guestAccessToken",
            refreshToken: "guestAccessToken",
            refreshTokenExpireDate: new Date(),
            accessTokenExpireDate: new Date(),
            device: "Ifong 112",
            platform: "guestA",
            deviceUUID: "UUUID",
            createDate:new Date(),
            updateDate:new Date()
        })
        await createdCredential.save()
        return {
            account:createdAccount,
            credential:createdCredential
        }
    }

    async update(){

    }

    async delete(){

    }

    async findById(id:any){
        return this.accountModel.findById(id)
    }

    async getTotalDocuments(){
        return  this.accountModel.countDocuments().exec()
    }
}