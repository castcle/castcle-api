import { Environment } from '@castcle-api/environments';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  QRCODE_STANDARD_SIZE_CONFIGS,
} from '../config';
import { Downloader } from './downloader';
import { predictContents, predictSuggestion } from './functions';
import { Image, ImageUploadOptions } from './image';
import { UploadOptions, Uploader } from './uploader';

@Module({
  imports: [
    HttpModule.register({
      timeout: Environment.HTTP_TIME_OUT,
    }),
  ],
  controllers: [],
  providers: [Downloader],
  exports: [HttpModule, Downloader],
})
export class UtilsAwsModule {}

export {
  Image,
  Uploader,
  UploadOptions,
  Downloader,
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  QRCODE_STANDARD_SIZE_CONFIGS,
  ImageUploadOptions,
  predictContents,
  predictSuggestion,
};
