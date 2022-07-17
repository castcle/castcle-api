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

export enum LocalizationLang {
  Thai = 'th',
  English = 'en',
}
export class CastcleLocalization {
  static getTemplateLike = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} ถูกใจ cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} ถูกใจ cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน ถูกใจ cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} like ${page || 'your'} cast`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} like ${
              page || 'your'
            } cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people like ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateComment = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} แสดงความคิดเห็นบน cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${
              displayNames[1]
            } แสดงความคิดเห็นบน cast ของ${page ? ' ' + page : 'คุณ'}`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน แสดงความคิดเห็นบน cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} commented on ${page || 'your'} cast`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} commented on ${
              page || 'your'
            } cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people commented on ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateFarm = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} farm cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} farm cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน farm cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} farm ${page || 'your'} cast`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} farm ${
              page || 'your'
            } cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people farm ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateQuote = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} quote cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} quote cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน quote cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} quote ${page || 'your'} cast`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} quote ${
              page || 'your'
            } cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people quote ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateRecast = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} recast cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} recast cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน recast cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} recast ${page || 'your'} cast`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} recast ${
              page || 'your'
            } cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people recast ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateReply = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} ตอบกลับความคิดเห็นบน cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${
              displayNames[1]
            } ตอบกลับความคิดเห็นบน cast ของ${page ? ' ' + page : 'คุณ'}`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน ตอบกลับความคิดเห็นบน cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} reply commented on ${
              page || 'your'
            } cast`;
          case 2:
            return `${displayNames[0]} and ${
              displayNames[1]
            } reply commented on ${page || 'your'} cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people reply commented on ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateSystem = (language: string, displayNames: string[]) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return ``;
          case 2:
            return ``;
          default:
            return ``;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return ``;
          case 2:
            return ``;
          default:
            return ``;
        }
    }
  };
  static getTemplateTag = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} แท็กถึง${page ? ' ' + page : 'คุณ'}`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} แท็กถึง${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน แท็กถึง${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} tag to ${page || 'you'}`;
          case 2:
            return `${displayNames[0]} and ${displayNames[1]} tag to ${
              page || 'you'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people tag to ${page || 'you'}`;
        }
    }
  };
  static getTemplateAdsApprove = (language: string) => {
    switch (language) {
      case LocalizationLang.Thai:
        return `โฆษณาของคุณได้รับการอนุมัติเรียบร้อยแล้ว`;
      default:
        return `Your ads has been approved`;
    }
  };
  static getTemplateAdsDecline = (language: string) => {
    switch (language) {
      case LocalizationLang.Thai:
        return `โฆษณาของคุณปฏิเสธ กรุณาตรวจสอบใหม่อีกครั้ง`;
      default:
        return `Your ads is declined. Please check again`;
    }
  };

  static getTemplateIllegalDone = (language: string) => {
    switch (language) {
      case LocalizationLang.Thai:
        return `Cast violates Castcle Terms and Agreement. Please review`;
      default:
        return `Cast violates Castcle Terms and Agreement. Please review`;
    }
  };

  static getTemplateIllegalClosed = (language: string) => {
    switch (language) {
      case LocalizationLang.Thai:
        return `Your cast has been removed by Castcle's admin`;
      default:
        return `Your cast has been removed by Castcle's admin`;
    }
  };

  static getTemplateNotIllegal = (language: string) => {
    switch (language) {
      case LocalizationLang.Thai:
        return `Your Cast has been reviewed. It will become visible again`;
      default:
        return `Your Cast has been reviewed. It will become visible again`;
    }
  };

  static getTemplateLikeComment = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} ถูกใจความคิดเห็น cast ของ${
              page ? ' ' + page : 'คุณ'
            }`;
          case 2:
            return `${displayNames[0]} และ ${
              displayNames[1]
            } ถูกใจความคิดเห็น cast ของ${page ? ' ' + page : 'คุณ'}`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน ถูกใจความคิดเห็น cast ของ${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} like commented on ${
              page || 'your'
            } cast`;
          case 2:
            return `${displayNames[0]} and ${
              displayNames[1]
            } like commented on ${page || 'your'} cast`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people like commented on ${page || 'your'} cast`;
        }
    }
  };
  static getTemplateFollow = (
    language: string,
    displayNames: string[],
    page = '',
  ) => {
    switch (language) {
      case LocalizationLang.Thai:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} ได้ติดตาม${page ? ' ' + page : 'คุณ'}`;
          case 2:
            return `${displayNames[0]} และ ${displayNames[1]} ได้ติดตาม${
              page ? ' ' + page : 'คุณ'
            }`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} และ อีก ${
              displayNames.length - 2
            } คน ได้ติดตาม${page ? ' ' + page : 'คุณ'}`;
        }
      default:
        switch (displayNames.length) {
          case 1:
            return `${displayNames[0]} started following ${page || 'you'}`;
          case 2:
            return `${displayNames[0]} and ${
              displayNames[1]
            } started following ${page || 'you'}`;
          default:
            return `${displayNames[0]}, ${displayNames[1]} and ${
              displayNames.length - 2
            } other people started following ${page || 'you'}`;
        }
    }
  };
}
