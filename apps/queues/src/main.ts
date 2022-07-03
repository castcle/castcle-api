/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const port = process.env.PORT || 3343;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: ${await app.getUrl()}/`);
  Logger.log(`Environment at ${process.env.NODE_ENV}`);
}

bootstrap();
