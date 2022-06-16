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

export enum SizeName {
  ORIGINAL = 'original',
  THUMBNAIL = 'thumbnail',
  MEDIUM = 'medium',
  LARGE = 'large',
  FULL_HD = 'fullHd',
}

export type Size = {
  name: string;
  width: number;
  height: number;
};

/** 2 days expiration time (in milliseconds)  */
export const EXPIRE_TIME = 2 * 24 * 60 * 60 * 1000;
export const IMAGE_BUCKET_FOLDER = 'images';

export const AVATAR_SIZE_CONFIGS: Size[] = [
  { name: 'thumbnail', width: 120, height: 120 },
  { name: 'medium', width: 480, height: 480 },
  { name: 'large', width: 1080, height: 1080 },
  { name: 'fullHd', width: 1920, height: 1920 },
];

export const COMMON_SIZE_CONFIGS: Size[] = [
  { name: 'thumbnail', width: 640, height: 360 },
  { name: 'medium', width: 960, height: 540 },
  { name: 'large', width: 1280, height: 720 },
  { name: 'fullHd', width: 1920, height: 1080 },
];

export const QR_CODE_STANDARD_SIZE_CONFIGS: Size[] = [
  { name: 'thumbnail', width: 250, height: 250 },
  { name: 'medium', width: 690, height: 690 },
  { name: 'large', width: 1024, height: 1024 },
];
