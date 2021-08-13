import { Module } from '@nestjs/common';
import { Image } from './image';
import { Uploader, UploadOptions } from './uploader';

@Module({
  controllers: [],
  providers: [],
  exports: []
})
export class UtilsAwsModule {}

export { Image, Uploader, UploadOptions };
