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

/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Configs } from '@castcle-api/environments';
import { Documentation } from '@castcle-api/utils/commons';
import { CastcleExceptionFilter } from '@castcle-api/utils/exception';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const port = process.env.PORT || 3334;
  const fastifyAdapter = new FastifyAdapter();

  fastifyAdapter
    .getInstance()
    .addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_, body: string, done) => {
        try {
          done(null, JSON.parse(body || '{}'));
        } catch (err) {
          done(err, {});
        }
      },
    );

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  Documentation.setup('Authentications', app);
  app.useGlobalFilters(new CastcleExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors();
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name,
  });

  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: ${await app.getUrl()}/`);
  Logger.log(`Environment at ${process.env.NODE_ENV}`);
}

bootstrap();
