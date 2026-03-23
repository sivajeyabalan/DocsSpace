import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { TenantResolverMiddleware } from './tenant/tenant-resolver.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    CollabModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantResolverMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
