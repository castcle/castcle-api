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

import { Environment } from '@castcle-api/environments';
import { ConsoleLogger, ConsoleLoggerOptions, LogLevel } from '@nestjs/common';

export class CastLogger extends ConsoleLogger {
  private static Levels: LogLevel[] = Environment.IS_PRODUCTION
    ? ['log', 'error', 'warn']
    : ['log', 'error', 'warn', 'debug', 'verbose'];

  private timer: Record<string, number> = {};

  /**
   * Create a logger with context and default options: `CastLoggerOptions`
   */
  constructor(
    context?: string,
    options: ConsoleLoggerOptions = {
      logLevels: CastLogger.Levels,
      timestamp: true,
    },
  ) {
    super(context, options);
  }

  private formatContext = (context?: string, time?: number) => {
    const logContext = context ? `#${context}` : '';
    const timeContext = time ? `+${time}ms` : '';

    return `${this.context}${logContext}${timeContext}`;
  };

  /**
   * Write a 'log' level log.
   */
  log(message: any, context?: string) {
    super.log(message, this.formatContext(context));
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, context?: string) {
    super.error(
      message instanceof Error
        ? JSON.stringify({
            name: message.name,
            message: message.name,
            stack: message.stack,
          })
        : typeof message === 'string'
        ? message
        : JSON.stringify(message),
      '',
      this.formatContext(context),
    );
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, context?: string) {
    super.warn(message, this.formatContext(context));
  }

  time(message: any, context?: string) {
    this.timer[JSON.stringify({ context, message })] = Date.now();
  }

  timeEnd(message: any, context?: string) {
    const afterMs = Date.now();
    const beforeMs = this.timer[JSON.stringify({ context, message })];

    if (!beforeMs) return;

    const time = afterMs - beforeMs;

    delete this.timer[JSON.stringify({ context, message })];

    super.log(message, this.formatContext(context, time));
  }
}
