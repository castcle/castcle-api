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
    message: 'The requested URL was not found.'
  },
  '1002': {
    statusCode: '401',
    code: '1002',
    message: 'Missing Authorization header.'
  },
  '1003': {
    statusCode: '401',
    code: '1003',
    message: 'Access token is expired.'
  },
  '1004': {
    statusCode: '401',
    code: '1004',
    message: 'Refresh token is expired.'
  },
  '1005': {
    statusCode: '401',
    code: '1005',
    message: 'รูปแบบไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  },
  '1006': {
    statusCode: '401',
    code: '1006',
    message: 'อัพโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  },
  '1007': {
    statusCode: '403',
    code: '1007',
    message: 'ไม่สามารถเข้าถึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
  },
  '3001': {
    statusCode: '400',
    code: '3001',
    message: 'Incorrect username or password.'
  },
  '3002': {
    statusCode: '400',
    code: '3002',
    message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาระบุใหม่อีกครั้ง'
  },
  '3003': {
    statusCode: '400',
    code: '3003',
    message: 'ไม่มี email หรือ mobile ในระบบ '
  },
  '3004': {
    statusCode: '400',
    code: '3004',
    message: 'opt ไม่ถูกต้อง หรือ หมดอายุ'
  },
  '3005': {
    statusCode: '400',
    code: '3005',
    message: 'payload กับ channel ไม่ตรงกัน'
  },
  '3006': {
    statusCode: '400',
    code: '3006',
    message: 'refId ไม่ถูกต้อง หรือ หมดอายุ '
  },
  '3007': {
    statusCode: '400',
    code: '3007',
    message: 'role ไม่ถูกต้อง '
  },
  '3008': {
    statusCode: '400',
    code: '3008',
    message: 'รหัส OTP ไม่ถูกต้อง กรุณาระบุใหม่อีกครั้ง'
  },
  '3009': {
    statusCode: '400',
    code: '3009',
    message: 'รูปแบบ email ไม่ถูกต้อง'
  },
  '3010': {
    statusCode: '400',
    code: '3010',
    message:
      'ระบุรหัส OTP ไม่ถูกต้องเกิน 3 ครั้ง กรุณาระบุหมายเลขโทรศัพท์ หรือ อีเมล เพื่อขอรับรหัส OTP ใหม่อีกครั้ง'
  },
  '3011': {
    statusCode: '400',
    code: '3009',
    message: 'รหัสผ่านไม่ถูกต้อง กรุณาระบุใหม่อีกครั้ง'
  },
  '3012': {
    statusCode: '400',
    code: '3012',
    message: 'refCode ไม่ถูกต้อง หรือ หมดอายุ'
  },
  '3013': {
    statusCode: '400',
    code: '3013',
    message: 'role ไม่ถูกต้อง'
  },
  '3014': {
    statusCode: '400',
    code: '3014',
    message: 'email หรือ mobile มีในระบบแล้ว'
  },
  '3015': {
    statusCode: '400',
    code: '3015',
    message: 'มีชื่อเพจนี้แล้ว โปรดเลือกชื่ออื่น'
  },
  '3016': {
    statusCode: '400',
    code: '3016',
    message: 'มีชื่อผู้ใช้นี้แล้ว โปรดเลือกชื่อผู้ใช้อื่น'
  },
  '3017': {
    statusCode: '400',
    code: '3017',
    message: 'มีชื่อผู้ใช้ไอดีนี้แล้ว โปรดเลือกชื่อผู้ใช้อื่น'
  },
  '4001': {
    statusCode: '404',
    code: '4001',
    message: 'ไม่พบบุคคลหรือเพจ กรุณาลองใหม่อีกครั้ง'
  },
  '5001': {
    statusCode: '400',
    code: '5001',
    message: 'feature ไม่รับรอง type นี้'
  },
  '5002': {
    statusCode: '400',
    code: '5002',
    message: 'type กับ payload ไม่ตรงกัน'
  },
  '5003': {
    statusCode: '404',
    code: '5003',
    message: 'ไม่พบโพสต์หรือหัวข้อ กรุณาลองใหม่อีกครั้ง'
  },
  '6001': {
    statusCode: '400',
    code: '6001',
    message: 'ไม่พบการแจ้งเตือน กรุณาลองใหม่อีกครั้ง'
  },
  '7001': {
    statusCode: '400',
    code: '7001',
    message: 'ขออภัย มีบางอย่างผิดพลาด กรุณาลองใหม่อีกครั้ง'
  }
};
