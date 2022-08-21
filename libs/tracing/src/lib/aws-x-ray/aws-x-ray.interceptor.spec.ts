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

import { TracingService } from '@narando/nest-xray';
import { lastValueFrom, of } from 'rxjs';
import { AwsXRayInterceptor } from './aws-x-ray.interceptor';

describe('#AWS XRayInterceptor', () => {
  const handler = {
    getHandler: jest.fn().mockReturnValue({ name: 'test' }),
  } as any;

  const next = { handle: () => of(null) } as any;
  const subSegment = { close: jest.fn() };
  const tracingService = {
    createSubSegment: jest.fn().mockReturnValue(subSegment),
  } as unknown as TracingService;

  let interceptor: AwsXRayInterceptor;

  beforeEach(async () => {
    interceptor = new AwsXRayInterceptor(tracingService);
  });

  it(`should be able aws xray is flow.`, async () => {
    await lastValueFrom(interceptor.intercept(handler, next));
    expect(tracingService.createSubSegment).toBeCalledTimes(1);
    expect(subSegment.close).toBeCalledTimes(1);
  });
  it(`should be able aws xray is wrong.`, async () => {
    await lastValueFrom(interceptor.intercept(handler, next));
    expect(
      next.handle().pipe(() => {
        subSegment.close();
        return Promise.reject(new Error('some error'));
      }),
    ).rejects.toThrowError();
    expect(subSegment.close).toBeCalledTimes(3);
  });
});
