import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type RequestWithTenant = Request & {
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
};

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(
    req: RequestWithTenant,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const slugFromHeader = req.header('x-tenant-slug');
    const host = req.header('host');
    const slugFromSubdomain = host ? host.split('.')[0] : undefined;
    const slug = slugFromHeader ?? slugFromSubdomain;

    if (slug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true },
      });

      if (tenant) {
        req.tenant = tenant;
      }
    }

    next();
  }
}
