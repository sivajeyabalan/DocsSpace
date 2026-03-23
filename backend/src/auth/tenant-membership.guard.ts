import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type RequestWithAuthAndTenant = Request & {
  authUser?: {
    sub: string;
    tenantId: string;
    role: string;
    jti: string;
    exp: number;
    iat: number;
  };
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
};

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthAndTenant>();
    const authUser = request.authUser;
    const tenant = request.tenant;

    if (!authUser) {
      throw new UnauthorizedException('Missing authenticated user context');
    }

    if (!tenant) {
      throw new UnauthorizedException('Missing tenant context');
    }

    if (authUser.tenantId !== tenant.id) {
      throw new ForbiddenException(
        'Token tenant does not match request tenant',
      );
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: authUser.sub,
          tenantId: tenant.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('No active membership for this tenant');
    }

    return true;
  }
}
