import { Environment } from '@castcle-api/environments';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { Downloader } from './downloader';
import { Image, ImageUploadOptions } from './image';
import { Uploader, UploadOptions } from './uploader';
import { AVATAR_SIZE_CONFIGS, COMMON_SIZE_CONFIGS } from '../config';
import { predictContents } from './functions/predict-content';

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
  ImageUploadOptions,
  predictContents,
};
