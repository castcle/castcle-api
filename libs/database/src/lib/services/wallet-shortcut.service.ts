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

import { Configs, Environment } from '@castcle-api/environments';
import { CastcleImage } from '@castcle-api/utils/aws';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import {
  ShortcutInternalDto,
  ShortcutSort,
  WalletOptions,
  WalletResponse,
} from '../dtos';
import { Repository } from '../repositories';
import { User, WalletShortcut } from '../schemas';

@Injectable()
export class WalletShortcutService {
  constructor(private repository: Repository) {}

  toWalletResponse(
    user: User,
    otherChain?: WalletShortcut,
    overwrites?: WalletOptions,
  ) {
    return {
      id: otherChain?._id ?? user._id,
      chainId: otherChain?.chainId ?? Environment.CHAIN_INTERNAL,
      castcleId: user.displayId,
      userId: user._id,
      type: user.type,
      order: otherChain?.order,
      displayName: otherChain?.displayName ?? user.displayName,
      walletAddress: !isMongoId(otherChain?.address)
        ? otherChain?.address
        : undefined,
      images: {
        avatar: user.profile?.images?.avatar
          ? CastcleImage.sign(user.profile.images.avatar)
          : Configs.DefaultAvatarImages,
      },
      memo: otherChain?.memo,
      createdAt:
        otherChain?.createdAt?.toISOString() ?? user.createdAt?.toISOString(),
      updatedAt:
        otherChain?.updatedAt?.toISOString() ?? user.createdAt?.toISOString(),
      ...overwrites,
    } as WalletResponse;
  }

  async createWalletShortcut(body: ShortcutInternalDto, accountId: string) {
    //TODO !!! Now! Check internal chain only.
    if (body.chainId !== Environment.CHAIN_INTERNAL)
      throw new CastcleException('INTERNAL_CHAIN_NOT_FOUND');

    const user = await this.repository.findUser({ _id: body.userId });
    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const walletShortcut = await this.repository.findWallerShortcut({
      address: body.userId,
      accountId,
    });

    if (walletShortcut) throw new CastcleException('WALLET_SHORTCUT_IS_EXIST');

    const newShortcut = await this.repository.createWallerShortcut({
      ...body,
      address: body.userId,
      account: accountId,
    });

    return this.toWalletResponse(user, newShortcut);
  }

  async getWalletShortcut(accountId: string) {
    const walletShortcuts = await this.repository.findWallerShortcuts(
      {
        accountId,
      },
      {
        sort: {
          createAt: -1,
          order: 1,
        },
      },
    );

    const userId = walletShortcuts
      .filter((shortcut) => isMongoId(shortcut.address))
      .map((shortcut) => shortcut.address);

    const users = await this.repository.findUsers({ _id: userId });

    const usersOwner = await this.repository.findUsers({ accountId });

    const shortcutResponses = walletShortcuts.map((shortcut) => {
      const user = users.find((user) => String(user._id) === shortcut.address);
      return this.toWalletResponse(user, shortcut);
    });

    const accountResponses = usersOwner.map((user) => {
      return this.toWalletResponse(user, undefined, {
        id: null,
        order: undefined,
      });
    });
    return {
      accounts: accountResponses,
      shortcuts: shortcutResponses,
    };
  }

  async deleteWalletShortcut(accountId: string, shortcutId: string) {
    await this.repository.deleteWalletShortcut({
      accountId,
      _id: shortcutId,
    });
  }

  async sortWalletShortcut(dto: ShortcutSort[], accountId: string) {
    await Promise.all(
      dto.map((shortcut) =>
        this.repository.updateWallerShortcut(
          {
            accountId,
            _id: shortcut.id,
          },
          {
            $set: {
              order: shortcut.order,
            },
          },
        ),
      ),
    );
  }
}
