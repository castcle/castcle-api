import { Environment } from '@castcle-api/environments';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AWSClient } from './aws.client';
import { Downloader } from './downloader';
import { predictContents, predictSuggestion } from './functions';
import { CastcleImage, Image } from './image';
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
  AWSClient,
  CastcleImage,
  Downloader,
  Image,
  predictContents,
  predictSuggestion,
  Uploader,
  UploadOptions,
};
