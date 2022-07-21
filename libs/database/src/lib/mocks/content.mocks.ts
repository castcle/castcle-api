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
import { ShortPayload } from '../dtos';
import { ContentType } from '../models';
import { Content, User } from '../schemas';

type MockContentOption = {
  amount?: number;
  type?: ContentType;
};

export const mockContents = async (
  user: User,
  contentModel: Model<Content>,
  option?: MockContentOption,
) => {
  const amount = option.amount ? option.amount : 1;
  const type = option.type ? option.type : ContentType.Short;
  const contents: Content[] = [];
  for (let i = 0; i < amount; i++) {
    const payload: ShortPayload = {
      message: 'this is short ' + i,
    };
    const content = new contentModel({
      type,
      author: user.toAuthor(),
      payload,
      revisionCount: 1,
    });
    contents.push(await content.save());
  }
  return contents;
};
