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

export const DefaultErrors = {
  INTERNAL_SERVER_ERROR: {
    statusCode: '500',
    code: '0000',
    message: 'Sorry, Something went wrong. Please try again',
  },
  REQUEST_URL_NOT_FOUND: {
    statusCode: '404',
    code: '1001',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  MISSING_AUTHORIZATION_HEADERS: {
    statusCode: '401',
    code: '1002',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  INVALID_ACCESS_TOKEN: {
    statusCode: '401',
    code: '1003',
    message: 'Invalid access token or expire',
  },
  INVALID_REFRESH_TOKEN: {
    statusCode: '401',
    code: '1004',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  INVALID_FORMAT: {
    statusCode: '401',
    code: '1005',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  UPLOAD_FAILED: {
    statusCode: '401',
    code: '1006',
    message: 'Image upload failed. Please try again.',
  },
  FORBIDDEN: {
    statusCode: '403',
    code: '1007',
    message: 'Can not access the data. Please try again.',
  },
  INVALID_MAX_RESULT: {
    statusCode: '400',
    code: '1008',
    message: `The 'maxResults' query parameter value is not between 5 and 100`,
  },
  RATE_LIMIT_REQUEST: {
    statusCode: '429',
    code: '1010',
    message: `Please wait a few minutes before you try again.`,
  },
  RECAPTCHA_FAILED: {
    statusCode: '400',
    code: '1011',
    message: `Captcha failed please try again`,
  },
  UNABLE_TO_SYNC: {
    statusCode: '400',
    code: '1012',
    message: `Unable to sync with social platform`,
  },
  INVALID_AUTH_TOKEN: {
    statusCode: '400',
    code: '3001',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  INVALID_EMAIL_OR_PASSWORD: {
    statusCode: '400',
    code: '3002',
    message: 'Incorrect email address or password. Please try again.',
  },
  INVALID_EMAIL: {
    statusCode: '400',
    code: '3003',
    message: 'Incorrect email address. Please try again.',
  },
  INVALID_PHONE_NUMBER: {
    statusCode: '400',
    code: '3004',
    message: 'Invalid phone number. Please try again.',
  },
  PAYLOAD_CHANNEL_MISMATCH: {
    statusCode: '400',
    code: '3005',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  EMAIL_OR_PHONE_NOT_FOUND: {
    statusCode: '400',
    code: '3006',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  PLEASE_TRY_AGAIN: {
    statusCode: '400',
    code: '3007',
    message: 'Please try again in 5 minutes.',
  },
  INVALID_OTP: {
    statusCode: '400',
    code: '3008',
    message: 'Invalid OTP code. Please try again.',
  },
  INVALID_EMAIL_OTP: {
    statusCode: '400',
    code: '3008',
    message: 'Invalid email OTP code. Please try again.',
  },
  INVALID_SMS_OTP: {
    statusCode: '400',
    code: '3008',
    message: 'Invalid SMS OTP code. Please try again.',
  },
  EXPIRED_OTP: {
    statusCode: '400',
    code: '3009',
    message:
      'The OTP has been requested past the time limit, please press the "Get OTP" button to request a new code again.',
  },
  EXPIRED_EMAIL_OTP: {
    statusCode: '400',
    code: '3009',
    message:
      'The email OTP has been requested past the time limit, please press the "Get OTP" button to request a new code again.',
  },
  EXPIRED_SMS_OTP: {
    statusCode: '400',
    code: '3009',
    message:
      'The SMS OTP has been requested past the time limit, please press the "Get OTP" button to request a new code again.',
  },
  LOCKED_OTP: {
    statusCode: '400',
    code: '3010',
    message:
      'Enter an incorrect OTP more than 3 times. Please enter your phone number or email to request a new OTP again.',
  },
  LOCKED_EMAIL_OTP: {
    statusCode: '400',
    code: '3010',
    message:
      'Enter an incorrect email OTP more than 3 times. Please enter your email to request a new OTP again.',
  },
  LOCKED_SMS_OTP: {
    statusCode: '400',
    code: '3010',
    message:
      'Enter an incorrect SMS OTP more than 3 times. Please enter your phone number to request a new OTP again.',
  },
  INVALID_PASSWORD: {
    statusCode: '400',
    code: '3011',
    message: 'Incorrect password. Please try again.',
  },
  INVALID_REF_CODE: {
    statusCode: '400',
    code: '3012',
    message: 'The request exceeded the time limit.',
  },
  INVALID_EMAIL_REF_CODE: {
    statusCode: '400',
    code: '3012',
    message: 'Invalid email ref code. Please try again.',
  },
  INVALID_SMS_REF_CODE: {
    statusCode: '400',
    code: '3012',
    message: 'Invalid SMS ref code. Please try again.',
  },
  INVALID_ROLE: {
    statusCode: '400',
    code: '3013',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  EMAIL_OR_PHONE_IS_EXIST: {
    statusCode: '400',
    code: '3014',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  PAGE_IS_EXIST: {
    statusCode: '400',
    code: '3015',
    message:
      'The name of this page already exists. Please choose another name.',
  },
  USER_NAME_IS_EXIST: {
    statusCode: '400',
    code: '3016',
    message: 'This username already exists. Please choose another username.',
  },
  USER_ID_IS_EXIST: {
    statusCode: '400',
    code: '3017',
    message: 'This Castcle Id already exists, please choose another name.',
  },
  MOBILE_NUMBER_ALREADY_EXISTS: {
    statusCode: '400',
    code: '3018',
    message: 'This phone number is already exists.',
  },
  SOCIAL_PROVIDER_IS_EXIST: {
    statusCode: '400',
    code: '3019',
    message:
      'There is already a connection to this social . Please change another channel.',
  },
  TWILIO_MAX_LIMIT: {
    statusCode: '400',
    code: '3020',
    message: 'Max send attempts reached. Please contact an administrator.',
  },
  DUPLICATE_EMAIL: {
    statusCode: '400',
    code: '3021',
    message: 'This email is already in Castcle.',
  },
  TWILIO_TOO_MANY_REQUESTS: {
    statusCode: '400',
    code: '3022',
    message: 'Please wait a few minutes before you try again.',
  },
  ADS_BOOST_STATUS_MISMATCH: {
    statusCode: '400',
    code: '3023',
    message: 'Sorry, Boost Status not match. Please try again.',
  },
  NO_PASSWORD_SET: {
    statusCode: '400',
    code: '3024',
    message: 'Cannot delete account. You have not set a password.',
  },
  EMAIL_NOT_FOUND: {
    statusCode: '404',
    code: '3025',
    message: 'Email could not be found. Please try again.',
  },
  MOBILE_NOT_FOUND: {
    statusCode: '404',
    code: '3026',
    message: 'Mobile could not be found. Please try again.',
  },
  OTP_USAGE_LIMIT_EXCEEDED: {
    statusCode: '400',
    code: '3027',
    message: 'OTP usage limit exceeded',
  },
  EMAIL_ALREADY_VERIFIED: {
    statusCode: '400',
    code: '3028',
    message: 'This email has been verified.',
  },
  USER_OR_PAGE_NOT_FOUND: {
    statusCode: '404',
    code: '4001',
    message: 'Username or the page could not be found. Please try again.',
  },
  CAMPAIGN_HAS_NOT_STARTED: {
    statusCode: '404',
    code: '4002',
    message: 'This campaign has not started',
  },
  NOT_ELIGIBLE_FOR_CAMPAIGN: {
    statusCode: '400',
    code: '4003',
    message: 'Not eligible for this campaign',
  },
  REACHED_MAX_CLAIMS: {
    statusCode: '400',
    code: '4004',
    message: 'Reached the maximum limit of claims',
  },
  REWARD_IS_NOT_ENOUGH: {
    statusCode: '400',
    code: '4005',
    message: 'The reward is not enough',
  },
  CHANGE_CASTCLE_ID_FAILED: {
    statusCode: '400',
    code: '4006',
    message: 'You cannot change your Castcle Id.',
  },
  INVALID_DATE: {
    statusCode: '400',
    code: '4007',
    message: 'Invalid date. Please try again.',
  },
  EMAIL_CAN_NOT_CHANGE: {
    statusCode: '400',
    code: '4008',
    message: `You can't change your email.`,
  },
  FEATURE_NOT_EXIST: {
    statusCode: '400',
    code: '5001',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  PAYLOAD_TYPE_MISMATCH: {
    statusCode: '400',
    code: '5002',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  CONTENT_NOT_FOUND: {
    statusCode: '404',
    code: '5003',
    message: 'Post or topic was not found. Please try again.',
  },
  RECAST_IS_EXIST: {
    statusCode: '404',
    code: '5004',
    message: 'You already recast this cast',
  },
  LIKE_IS_EXIST: {
    statusCode: '404',
    code: '5005',
    message: 'You already like this cast',
  },
  LIKE_COMMENT_IS_EXIST: {
    statusCode: '404',
    code: '5005',
    message: 'You already like this comment cast',
  },
  CONTENT_FARMING_ALREADY_FARM: {
    statusCode: '400',
    code: '5007',
    message: 'You already farm this cast',
  },
  CONTENT_FARMING_NOT_FOUND: {
    statusCode: '404',
    code: '5008',
    message: 'Farming not found',
  },
  CONTENT_FARMING_NOT_AVAILABLE_BALANCE: {
    statusCode: '400',
    code: '5009',
    message: "You don't have enough $CAST to farm",
  },
  CONTENT_FARMING_LIMIT: {
    statusCode: '400',
    code: '5010',
    message: 'You have reach your farming limit, please wait 24hrs',
  },
  QUOTE_IS_EXIST: {
    statusCode: '400',
    code: '5011',
    message: 'You already said that',
  },
  NOTIFICATION_NOT_FOUND: {
    statusCode: '400',
    code: '6001',
    message: 'Notification not found Please try again.',
  },
  SOMETHING_WRONG: {
    statusCode: '400',
    code: '7001',
    message: 'Sorry, Something went wrong. Please try again.',
  },
  INVALID_TRANSACTIONS_DATA: {
    statusCode: '400',
    code: '8001',
    message: 'Invalid transaction data',
  },
  NETWORK_NOT_FOUND: {
    statusCode: '404',
    code: '8002',
    message: 'Network not found',
  },
  WALLET_SHORTCUT_IS_EXIST: {
    statusCode: '400',
    code: '8003',
    message: 'Wallet shortcut is already exists.',
  },
  REPORTING_IS_EXIST: {
    statusCode: '400',
    code: '8004',
    message: 'Reporting is already exists.',
  },
  CAMPAIGN_TYPE_IS_EXIST: {
    statusCode: '400',
    code: '8005',
    message:
      'The Campaign type of Campaign already exists. Please choose another type.',
  },
  CAMPAIGN_NOT_FOUND: {
    statusCode: '404',
    code: '8006',
    message: 'Campaign could not be found. Please try again.',
  },
  NETWORK_TEMPORARILY_DISABLED: {
    statusCode: '400',
    code: '8007',
    message: 'Network has been temporarily disabled.',
  },
  NOT_ENOUGH_BALANCE: {
    statusCode: '400',
    code: '8008',
    message: 'Wallet does not have sufficient balance.',
  },
  RECEIVER_NOT_FOUND: {
    statusCode: '404',
    code: '8009',
    message: 'Receiver not found',
  },
  STAFF_NOT_FOUND: {
    statusCode: '404',
    code: '9001',
    message: 'Staff not found.',
  },
  REPORTING_SUBJECT_NOT_FOUND: {
    statusCode: '404',
    code: '8010',
    message: 'Reporting subject is not found. Please try again.',
  },
  REPORTING_NOT_FOUND: {
    statusCode: '404',
    code: '8011',
    message: 'Reporting is not found. Please try again.',
  },
  PAYMENT_TO_OWN_WALLET: {
    statusCode: '400',
    code: '8012',
    message: 'Payment to your own wallet is not supported.',
  },
  REPORTING_APPEAL_IS_EXISTS: {
    statusCode: '400',
    code: '8013',
    message: 'Reporting is appeal is already exists.',
  },
  REPORTING_STATUS_NOT_FOUND: {
    statusCode: '400',
    code: '8013',
    message: 'Reporting status not found. Please try again.',
  },
};
