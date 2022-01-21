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
  Account,
  Comment,
  Credential,
} from '@castcle-api/database/schemas';
import {
  InferSubjects,
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';

type Subjects =
  | InferSubjects<
      typeof User | typeof Content | typeof Account | typeof Comment
    >
  | 'all';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Engagement = 'engagement',
  Like = 'like',
  Recast = 'recast',
  Quote = 'quote',
  NotInterest = 'notinterest',
  Reply = 'reply',
  Report = 'report',
  Follow = 'follow',
  Comment = 'comment',
}

export type AppAbility = Ability<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  getUserManageContentAbility(users: UserDocument[], content: ContentDocument) {
    const { can, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );
    const findUser = users.findIndex(
      (u) => String(u._id) === String(content.author.id)
    );
    if (findUser >= 0) {
      can(Action.Update, Content);
      can(Action.Delete, Content);
    }

    return build({
      detectSubjectType: (item) => {
        console.log(item);
        return item.constructor as ExtractSubjectType<Subjects>;
      },
    });
  }

  createForCredential(credential: Credential) {
    const { can, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );
    /**
     * Credential Interaction
     */
    can(Action.Read, 'all');
    can(Action.Engagement, 'all');
    if (credential.account.activateDate) {
      console.log('check Activate', credential.account.activateDate);
      //verify user
      can(Action.Update, Content);
      can(Action.Delete, Content);
      can(Action.Create, Content);
      can(Action.Like, Content);
      can(Action.Recast, Content);
      can(Action.Quote, Content);
      can(Action.NotInterest, Content);
      can(Action.Comment, Content);
      //comment
      can(Action.Update, Comment);
      can(Action.Delete, Comment);
      can(Action.Create, Comment);
      can(Action.Like, Comment);
      can(Action.Reply, Content);
      //page
      can(Action.Update, User);
      can(Action.Delete, User);
      can(Action.Create, User);
      can(Action.Follow, User);
      can(Action.NotInterest, User);

      can(Action.Report, 'all');
    }
    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  createForUser(user: User) {
    const { can, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    );
    /**
     * Content Interaction
     */
    can(Action.Read, 'all');
    can(Action.Engagement, 'all');
    if (user.verified && (user.verified.email || user.verified.mobile)) {
      //verify user
      can(Action.Update, Content);
      can(Action.Delete, Content);
      can(Action.Create, Content);
      can(Action.Like, Content);
      can(Action.Recast, Content);
      can(Action.Quote, Content);
      can(Action.NotInterest, Content);
      can(Action.Comment, Content);
      //comment
      can(Action.Update, Comment);
      can(Action.Delete, Comment);
      can(Action.Create, Comment);
      can(Action.Like, Comment);
      can(Action.Reply, Content);
      //page
      can(Action.Update, User);
      can(Action.Delete, User);
      can(Action.Create, User);
      can(Action.Follow, User);
      can(Action.NotInterest, User);

      can(Action.Report, 'all');
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
