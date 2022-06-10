import { Environment } from '@castcle-api/environments';

export const getEmailVerificationHtml = (
  email: string,
  castcleLink: string = Environment.LINK_VERIFIED_EMAIL,
  supportEmail: string = Environment.SMTP_ADMIN_EMAIL,
) => `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<body style="margin:0;">
<!-- Embedded HTML code sent along with email begins here -->

<!-- Google Fonts Import -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400&family=Sarabun&display=swap" rel="stylesheet">
<!-- End of Google Fonts Import -->

<div style="width: 100%; height: calc(100% - 95px); background-color: #22252c; display: flex; align-items: center; justify-content: center;">
  <div style="display: inline-block; max-width: 400px; margin: 30px;">
    <table cellspacing="0" cellpadding="0" style="color: #e4e4e4; font-family: Kanit, sans-serif;">
      <tr>
        <td style="max-width: 80px;">
          <img src="https://castcle-public.s3.amazonaws.com/assets/castcle-logo.png" width="48" height="48" style="border:0;" />
        </td>
        <td style="font-weight: 400; font-size: 30px; text-align: center;">
          &nbsp;Welcome to <a href="castcle.com" target="_blank" style="color: #2dc2e3; font-weight: 300; text-decoration: none;">Castcle</a>
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
          <div style="font-family: Sarabun, sans-serif; font-size: 16px">
            Your email has been verified
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
        <td colspan="2" style="text-align: center;">
          <img border="0" width="64" height="64" alt=""  src="http://cdn.mcauto-images-production.sendgrid.net/f58346ed7c83a82e/8bfa0a4a-84ec-4242-8f55-6ac76381e07c/64x64.png" >
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
          <div style="border-radius: 5px; border: 1px solid #020403; background-color: #17181a; padding: 17px; color: #2dc2e3; font-weight: 300; font-size: 20px; text-align: center; max-width:300px; word-wrap: break-word;">
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
          <a href="${castcleLink}" style="display: block; text-decoration: none; border-radius: 30px; height: 30px; background-color: #2dc2e3; padding: 12px; color: #fff; font-weight: 300; font-size: 18px; text-align: center;">
            Back to Castcle
          </a>
        </td>
      </tr>
      <tr style="height: 15px;">
        <td colspan="2">
          <!-- padding -->
          &nbsp;
        </td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: center; padding: 0px 13px;">
          <div style="font-size: 16px; color: white;">
            Thank you for JOINING us!
          </div>
          <div style="font-family: Kanit, sans-serif; font-weight: 300; font-size: 14px; color: #6c7071; margin-top: 10px;">
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
