import { CastcleLocalization, LocalizationLang } from './localization';
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

describe('CastcleLocalization', () => {
  describe('#getTemplateLike', () => {
    describe('Localization thai.', () => {
      it('should get template like one thai language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 ถูกใจ cast ของคุณ');
      });
      it('should get template like two people thai language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 ถูกใจ cast ของคุณ');
      });
      it('should get template like more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน ถูกใจ cast ของคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template like one default language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 like your cast');
      });
      it('should get template like two people default language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 like your cast');
      });
      it('should get template like more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateLike(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people like your cast',
        );
      });
    });
  });
  describe('#getTemplateComment', () => {
    describe('Localization thai.', () => {
      it('should get template comment one thai language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 แสดงความคิดเห็นบน cast ของคุณ');
      });
      it('should get template comment two people thai language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual(
          'test1 และ test2 แสดงความคิดเห็นบน cast ของคุณ',
        );
      });
      it('should get template comment more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 และ อีก 2 คน แสดงความคิดเห็นบน cast ของคุณ',
        );
      });
    });

    describe('Localization default', () => {
      it('should get template comment one default language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 commented on your cast');
      });
      it('should get template comment two people default language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 commented on your cast');
      });
      it('should get template comment more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateComment(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people commented on your cast',
        );
      });
    });
  });
  describe('#getTemplateFarm', () => {
    describe('Localization thai.', () => {
      it('should get template farm one thai language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 farm cast ของคุณ');
      });
      it('should get template farm two people thai language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 farm cast ของคุณ');
      });
      it('should get template farm more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน farm cast ของคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template farm one default language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 farm your cast');
      });
      it('should get template farm two people default language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 farm your cast');
      });
      it('should get template farm more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateFarm(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people farm your cast',
        );
      });
    });
  });
  describe('#getTemplateQuote', () => {
    describe('Localization thai.', () => {
      it('should get template quote one thai language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 quote cast ของคุณ');
      });
      it('should get template quote two people thai language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 quote cast ของคุณ');
      });
      it('should get template quote more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน quote cast ของคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template quote one default language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 quote your cast');
      });
      it('should get template quote two people default language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 quote your cast');
      });
      it('should get template quote more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateQuote(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people quote your cast',
        );
      });
    });
  });
  describe('#getTemplateRecast', () => {
    describe('Localization thai.', () => {
      it('should get template recast one thai language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 recast cast ของคุณ');
      });
      it('should get template recast two people thai language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 recast cast ของคุณ');
      });
      it('should get template recast more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน recast cast ของคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template recast one default language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 recast your cast');
      });
      it('should get template recast two people default language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 recast your cast');
      });
      it('should get template recast more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateRecast(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people recast your cast',
        );
      });
    });
  });
  describe('#getTemplateReply', () => {
    describe('Localization thai.', () => {
      it('should get template reply comment one thai language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 ตอบกลับความคิดเห็นบน cast ของคุณ');
      });
      it('should get template reply comment two people thai language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual(
          'test1 และ test2 ตอบกลับความคิดเห็นบน cast ของคุณ',
        );
      });
      it('should get template reply comment more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 และ อีก 2 คน ตอบกลับความคิดเห็นบน cast ของคุณ',
        );
      });
    });

    describe('Localization default', () => {
      it('should get template reply comment one default language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 reply commented on your cast');
      });
      it('should get template reply comment two people default language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 reply commented on your cast');
      });
      it('should get template reply comment more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateReply(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people reply commented on your cast',
        );
      });
    });
  });
  describe('#getTemplateTag', () => {
    describe('Localization thai.', () => {
      it('should get template tag one thai language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 แท็กถึงคุณ');
      });
      it('should get template tag two people thai language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 แท็กถึงคุณ');
      });
      it('should get template tag more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน แท็กถึงคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template tag one default language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 tag to you');
      });
      it('should get template tag two people default language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 tag to you');
      });
      it('should get template tag more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateTag(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 and 2 other people tag to you');
      });
    });
  });
  describe('#getTemplateAdsApprove', () => {
    describe('Localization thai.', () => {
      it('should get template approve ads one thai language.', () => {
        const message = CastcleLocalization.getTemplateAdsApprove(
          LocalizationLang.Thai,
        );
        expect(message).toEqual('โฆษณาของคุณได้รับการอนุมัติเรียบร้อยแล้ว');
      });
    });

    describe('Localization default', () => {
      it('should get template approve ads one default language.', () => {
        const message = CastcleLocalization.getTemplateAdsApprove(
          LocalizationLang.English,
        );
        expect(message).toEqual('Your ads has been approved');
      });
    });
  });
  describe('#getTemplateAdsDecline', () => {
    describe('Localization thai.', () => {
      it('should get template decline ads one thai language.', () => {
        const message = CastcleLocalization.getTemplateAdsDecline(
          LocalizationLang.Thai,
        );
        expect(message).toEqual('โฆษณาของคุณปฏิเสธ กรุณาตรวจสอบใหม่อีกครั้ง');
      });
    });

    describe('Localization default', () => {
      it('should get template decline ads one default language.', () => {
        const message = CastcleLocalization.getTemplateAdsDecline(
          LocalizationLang.English,
        );
        expect(message).toEqual('Your ads is declined. Please check again');
      });
    });
  });
  describe('#getTemplateLikeComment', () => {
    describe('Localization thai.', () => {
      it('should get template like comment one thai language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 ถูกใจความคิดเห็น cast ของคุณ');
      });
      it('should get template like comment two people thai language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 ถูกใจความคิดเห็น cast ของคุณ');
      });
      it('should get template like comment more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 และ อีก 2 คน ถูกใจความคิดเห็น cast ของคุณ',
        );
      });
    });

    describe('Localization default', () => {
      it('should get template like comment one default language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 like commented on your cast');
      });
      it('should get template like comment two people default language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 like commented on your cast');
      });
      it('should get template like comment more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateLikeComment(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people like commented on your cast',
        );
      });
    });
  });

  describe('#getTemplateFollow', () => {
    describe('Localization thai.', () => {
      it('should get template started following one thai language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.Thai,
          ['test1'],
        );
        expect(message).toEqual('test1 ได้ติดตามคุณ');
      });
      it('should get template started following two people thai language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.Thai,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 และ test2 ได้ติดตามคุณ');
      });
      it('should get template started following more than two people thai language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.Thai,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual('test1, test2 และ อีก 2 คน ได้ติดตามคุณ');
      });
    });

    describe('Localization default', () => {
      it('should get template like comment one default language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.English,
          ['test1'],
        );
        expect(message).toEqual('test1 started following you');
      });
      it('should get template like comment two people default language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.English,
          ['test1', 'test2'],
        );
        expect(message).toEqual('test1 and test2 started following you');
      });
      it('should get template like comment more than two people default language.', () => {
        const message = CastcleLocalization.getTemplateFollow(
          LocalizationLang.English,
          ['test1', 'test2', 'test3', 'test4'],
        );
        expect(message).toEqual(
          'test1, test2 and 2 other people started following you',
        );
      });
    });
  });
});
