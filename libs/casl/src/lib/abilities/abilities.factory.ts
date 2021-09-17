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
import {
  UserDocument,
  ContentDocument,
  User,
  Content,
  Account
} from '@castcle-api/database/schemas';
import {
  InferSubjects,
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  MongoQuery
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Document, Model } from 'mongoose';
import { EntityVisibility } from '@castcle-api/database/dtos';
import * as mongoose from 'mongoose';

type Subjects =
  | InferSubjects<typeof User | typeof Content | typeof Account>
  | 'all';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Engage = 'engage',
  Follow = 'follow'
}

export type AppAbility = Ability<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  getUserManageContentAbility(user: UserDocument, content: ContentDocument) {
    const { can, cannot, build } = new AbilityBuilder<
      Ability<[Action, Subjects]>
    >(Ability as AbilityClass<AppAbility>);
    if (String(user._id) === String(content.author.id)) {
      can(Action.Update, Content);
      can(Action.Delete, Content);
    }

    return build({
      detectSubjectType: (item) => {
        console.log(item);
        return item.constructor as ExtractSubjectType<Subjects>;
      }
    });
  }
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder<
      Ability<[Action, Subjects]>
    >(Ability as AbilityClass<AppAbility>);
    /**
     * Content Interaction
     */
    can(Action.Read, Content);
    //if use has activate date

    if (user.activated) {
      can(Action.Update, Content);
      can(Action.Delete, Content);
      can(Action.Create, Content);
      can(Action.Engage, Content);
    }
    /**
     * Comment
     */

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>
    });
  }
}
