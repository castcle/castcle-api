import { Configs } from '@castcle-api/environments';
import { ExceptionFilter } from '@castcle-api/utils/interceptors';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/authentications/src/app/app.module';
import { TwilioClient } from '../../../utils/clients/src/lib/twilio/twilio.client';
import { authenticationsApp } from '../variables';

export const setupAuthenticationsModule = async () => {
  const twilioClient = {
    requestOtp: () => {
      return {
        sid: 'VEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        service_sid: 'VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        account_sid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        to: '+15017122661',
        channel: 'sms',
        status: 'pending',
        valid: false,
        date_created: '2015-07-30T20:00:00Z',
        date_updated: '2015-07-30T20:00:00Z',
        lookup: {
          carrier: {
            error_code: null,
            name: 'Carrier Name',
            mobile_country_code: '310',
            mobile_network_code: '150',
            type: 'mobile',
          },
        },
        amount: null,
        payee: null,
        send_code_attempts: [
          {
            time: '2015-07-30T20:00:00Z',
            channel: 'SMS',
            channel_id: null,
          },
        ],
        url: 'https://verify.twilio.com/v2/Services/VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Verifications/VEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      };
    },
    verifyOtp: (receiver: string, otp: string) => {
      if (otp === '123456') {
        return { status: 'approved' };
      } else {
        return { status: 'pending' };
      }
    },
    canceledOtp: () => {
      return true;
    },
  };
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TwilioClient)
    .useValue(twilioClient)
    .compile();

  (authenticationsApp as any) = moduleFixture.createNestApplication();

  authenticationsApp.useGlobalPipes(new ValidationPipe());
  authenticationsApp.useGlobalFilters(new ExceptionFilter());
  authenticationsApp.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await authenticationsApp.init();
};

export const closeAuthenticationsModule = () => {
  return authenticationsApp.close();
};
