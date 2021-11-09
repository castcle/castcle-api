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

import { NestFactory } from '@nestjs/core';
import { AuthenticationModule } from './app/app.module';
import { Environment as env } from '@castcle-api/environments';
import {
  CastLogger,
  CastLoggerOptions,
  CastLoggerLevel
} from '@castcle-api/logger';
import { SwaggerModule } from '@nestjs/swagger';
import { DocumentConfig } from './docs/document.config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Configs } from '@castcle-api/environments';
import { ExceptionalInterceptor } from '@castcle-api/utils/interceptors';

async function bootstrap() {
  const logger = new CastLogger('Bootstrap', CastLoggerOptions);
  const app = await NestFactory.create(AuthenticationModule, {
    logger: CastLoggerLevel
  });
  const port = process.env.PORT || 3334;
  const prefix = 'authentications';

  // For Global
  app.setGlobalPrefix(prefix);

  // For versioning
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: Configs.RequiredHeaders.AcceptVersion.name
  });

  // For documentations
  const document = SwaggerModule.createDocument(app, DocumentConfig);
  SwaggerModule.setup(`${prefix}/documentations`, app, document);
  //TODO !!! social login need to add class validator  to use this
  /*app.useGlobalPipes(new ValidationPipe({
    forbidUnknownValues:true
  }));*/
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new ExceptionalInterceptor());
  await app.listen(port, () => {
    logger.log('Listening at http://localhost:' + port);
    logger.log(`Environment at ${env.node_env}`);
  });
}

bootstrap();
