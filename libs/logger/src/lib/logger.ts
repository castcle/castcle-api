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

import { ConsoleLogger, ConsoleLoggerOptions, LogLevel } from '@nestjs/common';
import { Environment as env } from '@castcle-api/environments';

export class CastLogger extends ConsoleLogger {
  /**
   * Create a logger with context and default options: `CastLoggerOptions`
   */
  constructor(context?: string, options = CastLoggerOptions) {
    super(context, options);
  }

  /**
   * Write a 'log' level log.
   */
  log(message: any, context?: string) {
    const argArray: Array<any> = [message];
    if (context) {
      argArray.push(context);
    }
    super.log.apply(this, argArray);
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, stack?: string, context?: string) {
    const argArray: Array<any> = [message];
    if (stack) {
      argArray.push(stack);
    }
    if (context) {
      argArray.push(context);
    }
    super.error.apply(this, argArray);
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, context?: string) {
    const argArray: Array<any> = [message];
    if (context) {
      argArray.push(context);
    }
    super.warn.apply(this, argArray);
  }
}

export const CastLoggerLevel: LogLevel[] = env.PRODUCTION
  ? ['log', 'error', 'warn']
  : ['log', 'error', 'warn', 'debug', 'verbose'];
export const CastLoggerOptions: ConsoleLoggerOptions = {
  logLevels: CastLoggerLevel,
  timestamp: true,
};
