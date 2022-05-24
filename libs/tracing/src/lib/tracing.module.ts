import { Environment } from '@castcle-api/environments';
import { TracingModule } from '@narando/nest-xray';
import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AwsXRayInterceptor } from './aws-x-ray/aws-x-ray.interceptor';

@Module({})
export class CastcleTracingModule {
  static forRoot(options: { serviceName: string }): DynamicModule {
    const module = CastcleTracingModule;

    if (!Environment.AWS_XRAY_DAEMON_ADDRESS) return { module };

    return {
      module,
      imports: [
        TracingModule.forRoot({
          serviceName: options.serviceName,
          daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
        }),
      ],
      providers: [{ provide: APP_INTERCEPTOR, useClass: AwsXRayInterceptor }],
    };
  }
}
