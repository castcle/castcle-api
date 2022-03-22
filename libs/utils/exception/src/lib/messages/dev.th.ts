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
export const DevErrorMessages = {
  '1001': {
    statusCode: '404',
    code: '1001',
    message: 'The requested URL was not found.',
  },
  '1002': {
    statusCode: '401',
    code: '1002',
    message: 'Missing Authorization header.',
  },
  '1003': {
    statusCode: '401',
    code: '1003',
    message: 'Invalid access token or expire',
  },
  '1004': {
    statusCode: '401',
    code: '1004',
    message: 'Invalid refresh token or expire',
  },
  '1005': {
    statusCode: '401',
    code: '1005',
    message: 'Invalid format',
  },
  '1006': {
    statusCode: '401',
    code: '1006',
    message: 'Image upload failed. Please try again.',
  },
  '1007': {
    statusCode: '403',
    code: '1007',
    message: 'Can not access the data. Please try again.',
  },
  '1008': {
    statusCode: '400',
    code: '1008',
    message: `The 'maxResults' query parameter value is not between 5 and 100`,
  },
  '1010': {
    statusCode: '429',
    code: '1010',
    message: `API rate limit exceeded `,
  },
  '1011': {
    statusCode: '400',
    code: '1011',
    message: `Captcha failed please try again`,
  },
  '3001': {
    statusCode: '400',
    code: '3001',
    message: 'Invalid auth token.',
  },
  '3002': {
    statusCode: '400',
    code: '3002',
    message: 'Incorrect email address or password. Please try again.',
  },
  '3003': {
    statusCode: '400',
    code: '3003',
    message: 'Incorrect email address. Please try again.',
  },
  '3004': {
    statusCode: '400',
    code: '3004',
    message: 'Invalid phone number. Please try again.',
  },
  '3005': {
    statusCode: '400',
    code: '3005',
    message: 'Payload and Channel do not match.',
  },
  '3006': {
    statusCode: '400',
    code: '3006',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  '3007': {
    statusCode: '400',
    code: '3007',
    message: 'Please try again in 5 minutes.',
  },
  '3008': {
    statusCode: '400',
    code: '3008',
    message: 'Invalid OTP code. Please try again.',
  },
  '3009': {
    statusCode: '400',
    code: '3009',
    message:
      'The OTP has been requested past the time limit, please press the "Get OTP" button to request a new code again.',
  },
  '3010': {
    statusCode: '400',
    code: '3010',
    message:
      'Enter an incorrect OTP more than 3 times. Please enter your phone number or email to request a new OTP again.',
  },
  '3011': {
    statusCode: '400',
    code: '3011',
    message: 'Incorrect password. Please try again.',
  },
  '3012': {
    statusCode: '400',
    code: '3012',
    message: 'Invalid ref code. Please try again.',
  },
  '3013': {
    statusCode: '400',
    code: '3013',
    message: 'Invalid role.',
  },
  '3014': {
    statusCode: '400',
    code: '3014',
    message: 'This email already exists. Please choose another email.',
  },
  '3015': {
    statusCode: '400',
    code: '3015',
    message:
      'The name of this page already exists. Please choose another name.',
  },
  '3016': {
    statusCode: '400',
    code: '3016',
    message: 'This username already exists. Please choose another username.',
  },
  '3017': {
    statusCode: '400',
    code: '3017',
    message: 'This Castcle Id already exists, please choose another name.',
  },
  '3018': {
    statusCode: '400',
    code: '3018',
    message: 'This phone number is already exists.',
  },
  '3019': {
    statusCode: '400',
    code: '3019',
    message:
      'There is already a connection to this social . Please change another channel.',
  },
  '3020': {
    statusCode: '400',
    code: '3020',
    message: 'Max send attempts reached. Please contact an administrator.',
  },
  '3021': {
    statusCode: '400',
    code: '3021',
    message: 'This email is already in Castcle.',
  },
  '3022': {
    statusCode: '400',
    code: '3022',
    message: 'Please wait a few minutes before you try again.',
  },
  '3023': {
    statusCode: '400',
    code: '3023',
    message: 'Sorry, Boost Status not match. Please try again.',
  },
  '4001': {
    statusCode: '404',
    code: '4001',
    message: 'Username or the page could not be found. Please try again.',
  },
  '4002': {
    statusCode: '404',
    code: '4002',
    message: 'This campaign has not started',
  },
  '4003': {
    statusCode: '400',
    code: '4003',
    message: 'Not eligible for this campaign',
  },
  '4004': {
    statusCode: '400',
    code: '4004',
    message: 'Reached the maximum limit of claims',
  },
  '4005': {
    statusCode: '400',
    code: '4005',
    message: 'The reward is not enough',
  },
  '4006': {
    statusCode: '400',
    code: '4005',
    message: 'You cannot change your Castcle Id.',
  },
  '5001': {
    statusCode: '400',
    code: '5001',
    message: 'Invalid feature.',
  },
  '5002': {
    statusCode: '400',
    code: '5002',
    message: 'Payload and Type do not match.',
  },
  '5003': {
    statusCode: '404',
    code: '5003',
    message: 'Post or topic was not found. Please try again.',
  },
  '5004': {
    statusCode: '404',
    code: '5004',
    message: 'You already recast this cast',
  },
  '6001': {
    statusCode: '400',
    code: '6001',
    message: 'Notification not found Please try again.',
  },
  '7001': {
    statusCode: '400',
    code: '7001',
    message: 'Sorry, Something went wrong. Please try again.',
  },
};
