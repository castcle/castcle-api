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

import { Logger } from '@nestjs/common';
import { connect, disconnect, Document, model } from 'mongoose';
import {
  CampaignStatus,
  CampaignType,
  UserType,
} from '../libs/database/src/lib/models';
import {
  AdsCampaign,
  AdsCampaignSchema,
  User,
  UserSchema,
  Transaction,
  TransactionSchema,
} from '../libs/database/src/lib/schemas';

class UpdateAds {
  static run = async () => {
    

    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const adsCampaignModel = model(AdsCampaign.name, AdsCampaignSchema);
    const userModel = model(User.name, UserSchema);
    const transactionModel = model(Transaction.name, TransactionSchema);
    const campaigns:AdsCampaign[] = await adsCampaignModel.find({});
    for(let i = 0 ; i < campaigns.length; i++){
      //campaigns[i].owner = 
      const newOwner = await userModel.findOne({ownerAccount:campaigns[i].owner as any, type: UserType.PEOPLE })
      campaigns[i].owner = newOwner;
      await campaigns[i].save();
    }
    const txs: Transaction[] = await transactionModel.find({'from.account':{$exists:true}});
    for(let i =0; i < txs.length; i++){
      txs[i].from.user = await userModel.findOne({ownerAccount: txs[i].from.account as any, type: UserType.PEOPLE});
      txs[i].markModified('from');
      await txs[i].save();
    }
    const txTos: Transaction[] = await transactionModel.find({'to.account':{$exists:true}});
    for(let i =0; i < txTos.length; i++){
      for(let j = 0; j < txTos[i].to.length ; j++ ) {
        if(txTos[i].to[j].account){
          txTos[i].to[j].user = await  userModel.findOne({ownerAccount: txTos[i].to[j].account as any, type: UserType.PEOPLE});
        }
      }
      txTos[i].markModified('to');
      await txTos[i].save();
    }
    //update viewer to userId
    await disconnect();

    console.info(JSON.stringify(campaigns, null, 4));
  };
}

UpdateAds.run().catch(console.error);
