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
  BANNED_NAMES,
  RESERVE_NAMES,
  RANDOM_ADJECTIVE,
  RANDOM_SUBJECTS,
  LENGTH_MAX,
  LENGTH_MIN,
} from './configs/names';

export class CastcleName {
  slug: string;
  isBanned: boolean;
  isReserved: boolean;
  isValid: boolean;
  suggestCastcleId: string;
  constructor(public name: string) {
    this.slug = CastcleName.convertToSlug(name);
    this.isBanned = CastcleName.isBannedName(name);
    this.isReserved = CastcleName.isReserveName(name);
    this.isValid = CastcleName.isValidName(name);
    this.suggestCastcleId = CastcleName.suggestCastcleId(name);
  }

  /**
   * Change name to lowercase + remove all space
   * @param {string }name
   * @returns {string}
   */
  static convertToSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '');
  }

  /**
   * convert name to slug and check if it exist in configs/names/ban.names
   * @param {string }name
   * @returns {boolean} return true if the name is ban name
   */
  static isBannedName(name: string) {
    return BANNED_NAMES.find((str) => str === this.convertToSlug(name))
      ? true
      : false;
  }

  /**
   * convert name to slug and check if it exist in configs/names/reserve.names
   * @param {string} name
   * @returns {boolean}
   */
  static isReserveName(name: string) {
    return RESERVE_NAMES.find((str) => str === this.convertToSlug(name))
      ? true
      : false;
  }

  /**
   * convert name to slug and check if length in ranges(in config) and if it has any special character
   * @param {string} name
   * @returns {boolean} return true if name is valid
   */
  static isValidName(name: string) {
    const lengthRule =
      this.convertToSlug(name).length >= LENGTH_MIN &&
      this.convertToSlug(name).length <= LENGTH_MAX;
    const format = /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    const specialCharacterRule = !format.test(name);
    return (
      lengthRule &&
      specialCharacterRule &&
      !this.isReserveName(name) &&
      !this.isBannedName(name)
    );
  }

  /**
   * remove all special character and if length is more than LENGTH_MAX slice it to the maxium length
   * @param {string} name
   * @returns {string}
   */
  static _preSuggest(name: string) {
    //remove any special character
    let replaceName = name.replace(
      /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/g,
      ''
    );
    if (name.length >= LENGTH_MAX)
      replaceName = replaceName.slice(0, LENGTH_MAX - 1);
    return replaceName;
  }

  /**
   * get name from _preSuggest and check
   * @param {string} name
   * @returns {string}
   */
  static suggestCastcleId(name: string) {
    const newName = this._preSuggest(name).toLowerCase();
    if (this.isValidName(newName)) return this.convertToSlug(newName);
    const subject =
      RANDOM_SUBJECTS[Math.floor(Math.random() * RANDOM_SUBJECTS.length)];
    const adjective =
      RANDOM_ADJECTIVE[Math.floor(Math.random() * RANDOM_ADJECTIVE.length)];
    return adjective + subject;
  }
}
