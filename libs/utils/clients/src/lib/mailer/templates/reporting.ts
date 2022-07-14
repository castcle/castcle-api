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

export type UserReport = {
  id: string;
  castcleId: string;
  displayName: string;
  images?: any;
  overview?: string;
  updatedAt?: Date;
};

export type ContentReport = {
  id: string;
  author: UserReport;
  link?: any[];
  message?: string;
  photo?: any;
  updatedAt: string;
};

export type Reporting = {
  action: string;
  actionBy?: any[];
  message: string;
  reportedBy: string;
  subject: string;
  type: string;
  user: UserReport;
};

export const getHtmlReportingContent = (
  content: ContentReport,
  reporting: Reporting,
) => {
  return `
  <body
    style="
      font-size: 1rem;
      padding: 0;
      margin: 0;
    ">
    <div style="padding: 15px; height: 100%; width: 750px; border-radius: 5px">
      <div style="background-color: #23262b; padding: 10px; display: flex; vertical-align: middle">
        <img
          src="https://castcle-public.s3.amazonaws.com/assets/castcle-logo.png"
          style="height: 30px; width: 30px"
        />
        <h3 style="color: #ffffff; margin: 0; margin-left: 15px">
          ${reporting.action} content (OID : ${content.id})
        </h3>
    </div>

      ${
        content.photo?.contents?.length
          ? `
    <div style="margin-top: 20px;">
     ${content.photo.contents?.map(
       (image) => `
      <a
          href="${image.original}"
          target="_blank"
          style="color: transparent">
          <img
            src="${image.medium}"
            style="
            height: ${content.photo.contents.length > 1 ? '250px' : '350px'};
            width: ${content.photo.contents.length > 1 ? '370px' : '100%'};
            object-fit: contain"
            alt="Content"
          />
      </a>`,
     )}
    </div>`
          : ''
      }
      <div style="margin-top: 20px">
        <table style="width: 100%; border-collapse: collapse">
           ${
             reporting.actionBy?.length
               ? `
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              Action by (Admin)
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${reporting.actionBy?.map(
                (actionBy) => `
              displayName : ${actionBy.firstName} ${actionBy.lastName}<br>
              Action : ${actionBy.action}<br>
              Status : ${actionBy.status}
              `,
              )}
            </td>
          </tr>`
               : ''
           }
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              Castcle name
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${reporting.user.displayName} (@${reporting.user.castcleId})
            </td>
          </tr>
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              Content message
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${content.message || '-'}
            </td>
          </tr>
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              Reported message
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${reporting.message || '-'}
            </td>
          </tr>
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              ${reporting.action} by
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
            ${reporting.reportedBy}
            </td>
          </tr>
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                width: 180px;
                font-weight: 700;
              ">
              Subject
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
            ${reporting.subject}
            </td>
          </tr>
            ${
              content.link?.length
                ? `
            <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
                width: 180px;
                font-weight: 700;
              ">
              Link
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${content.link?.map(
                (link) => `
                <div>
                  ${
                    link.url
                      ? `
                  URL : <a href="${link.url}" target="_blank">${link.url}</a><br>
                  `
                      : ''
                  }
                  ${
                    link.title
                      ? `
                  Title : ${link.title}<br>
                  `
                      : ''
                  }
                  ${
                    link.description
                      ? `
                    Description : ${link.url}<br>
                    `
                      : ''
                  }
                 ${
                   link.imagePreview
                     ? `
                  Preview : <a href="${link.imagePreview}" target="_blank">${link.imagePreview}</a><br>
                  `
                     : ''
                 }
                </div>
              `,
              )}
            </td>
          </tr>`
                : ''
            }
          <tr>
            <td
              style="
                white-space: nowrap;
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                width: 180px;
                font-weight: 700;
              ">
              Latest update
            </td>
            <td
              style="
                font-size: 13px;
                color: #23262b;
                padding: 4px;
                vertical-align: top;
              ">
              ${content.updatedAt}
            </td>
          </tr>
        </table>
      </div>
    </div>
  </body>
    `;
};

export const getHtmlReportingUser = (
  user: UserReport,
  reporting: Reporting,
) => {
  return `
  <body
    style="
      font-size: 1rem;
      padding: 0;
      margin: 0;
    ">
    <div style="padding: 15px; height: 100%; width: 750px; border-radius: 5px">
      <div style="background-color: #23262b; padding: 10px; display: flex; vertical-align: middle">
        <img
          src="https://castcle-public.s3.amazonaws.com/assets/castcle-logo.png"
          style="height: 30px; width: 30px"
        />
        <h3 style="color: #ffffff; margin: 0; margin-left: 15px">
          ${reporting.action} user (OID : ${user.id})
        </h3>
    </div>
    <div style="margin-top: 20px; text-align: center">
        ${
          user.images.avatar
            ? `
        <a
          href="${user.images.avatar.original}"
          target="_blank"
          style="color: transparent">
          <img
            src="${user.images.avatar.medium}"
            style="height: 250px; width: 100%; object-fit: contain"
            alt="Avatar" />
        </a>`
            : ''
        }
    </div>

      <div style="margin-top: 20px">
        <table style="width: 100%; border-collapse: collapse">
        ${
          reporting.actionBy
            ? `
       <tr>
         <td
           style="
             white-space: nowrap;
             font-size: 13px;
             color: #23262b;
             padding: 4px;
             vertical-align: top;
             width: 180px;
             font-weight: 700;
           ">
           Action by (Admin)
         </td>
         <td
           style="
             font-size: 13px;
             color: #23262b;
             padding: 4px;
             vertical-align: top;
           ">
           ${reporting.actionBy?.map(
             (actionBy) => `
          displayName : ${actionBy.firstName} ${actionBy.lastName}<br>
          Action : ${actionBy.action}<br>
          Status : ${actionBy.status}
          `,
           )}
         </td>
       </tr>`
            : ''
        }
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
              width: 180px;
              font-weight: 700;
            ">
            Castcle name
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
            ">
            ${reporting.user.displayName} (@${reporting.user.castcleId})
          </td>
        </tr>
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
              font-weight: 700;
            ">
            Overview
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
              width: 75%;
            ">
            ${user.overview || '-'}
          </td>
        </tr>
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
              width: 180px;
              font-weight: 700;
            ">
            Reported message
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
            ">
            ${reporting.message || '-'}
          </td>
        </tr>
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
              width: 180px;
              font-weight: 700;
            ">
            ${reporting.action} by
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
            ">
          ${reporting.reportedBy}
          </td>
        </tr>
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              width: 180px;
              font-weight: 700;
            ">
            Subject
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
            ">
          ${reporting.subject}
          </td>
        </tr>
        <tr>
          <td
            style="
              white-space: nowrap;
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              width: 180px;
              font-weight: 700;
            ">
            Latest update
          </td>
          <td
            style="
              font-size: 13px;
              color: #23262b;
              padding: 4px;
              vertical-align: top;
            ">
            ${user.updatedAt.toISOString()}
          </td>
        </tr>
      </table>
      </div>
    </div>
  </body>
    `;
};
