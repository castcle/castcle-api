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

export const getRegistrationHtml = (
  email: string,
  activationLink: string,
  supportEmail: string,
) => `<body style="margin:0;">
<!-- Embedded HTML code sent along with email begins here -->

<!-- Google Fonts Import -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400&family=Sarabun&display=swap" rel="stylesheet">
<!-- End of Google Fonts Import -->
<div style="width: 100%; background-color: #22252c; text-align: center;">
  <div style="display: inline-block; max-width: 400px; margin: 30px;">
    <table cellspacing="0" cellpadding="0" style="color: #e4e4e4; font-family: Kanit, sans-serif;">
      <tr>
        <td style="max-width: 80px;">
          <img src="https://castcle-public.s3.amazonaws.com/assets/castcle-logo.png" style="border:0; width: 100%;" />
        </td>
        <td style="font-weight: 400; font-size: 30px; text-align: center;">
          Welcome to <a href="castcle.com" target="_blank" style="color: #2dc2e3; font-weight: 300; text-decoration: none;">Castcle</a>
        </td>
      </tr>
      <tr style="height: 25px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: center; padding: 0px 13px;">
          <div style="font-family: Sarabun, sans-serif; font-size: 17px">
            To protect your Castcle account, please verify your email by clicking on the button below.
          </div>
        </td>
      </tr>
      <tr style="height: 15px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div style="border-radius: 5px; border: 1px solid #020403; background-color: #17181a; padding: 17px; color: #2dc2e3; font-weight: 300; font-size: 20px; text-align: center;">
            ${email}
          </div>
        </td>
      </tr>
      <tr style="height: 15px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <a href="${activationLink}" style="display: block; text-decoration: none; border-radius: 30px; height: 30px; background-color: #2dc2e3; padding: 12px; color: #fff; font-weight: 300; font-size: 18px; text-align: center;">
            Confirm Email
          </a>
        </td>
      </tr>
      <tr style="height: 30px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: center; padding: 0px 13px;">
          <div style="font-family: Sarabun, sans-serif; font-size: 13px">
            Not only for security reasons, i.e., recovering your password, your email will also be used for receiving Castcle notifications, like when someone has
            mentioned you on Castcle, etc. This aims for the most benefits and smooth experience of you on Castcle.
          </div>
        </td>
      </tr>
      <tr style="height: 40px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: center; padding: 0px 13px;">
          <div style="font-size: 17px; color: white;">
            Thank you for JOINING us!
          </div>
          <div style="font-family: Kanit, sans-serif; font-weight: 300; font-size: 15px; color: #6c7071; margin-top: 10px;">
            Please email to <a href="mailto:${supportEmail}" style="text-decoration: none; color: #2dc2e3;">${supportEmail}</a> for inquiries.
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
<div style="background-color: #17181a; padding: 10px; text-align: center;">
  <div style="display: inline-block; margin-top: 5px;">
    <img src="https://castcle-public.s3.amazonaws.com/assets/castcle-email-footer.png" border="0" style="max-height: 45px;" />
  </div>
  <br />
  <div style="display: inline-block; font-family: Kanit, sans-serif; font-weight: 300; font-size: 12px; color: #6c7071; margin-top: 7px;">
    &copy; Castcle Co., Ltd., Thailand, 2021. All Rights Reserved.
  </div>
</div>

<!-- End of embedded HTML code -->
</body>`;
