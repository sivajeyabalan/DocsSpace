import type { MembershipRole, Tenant } from '@prisma/client';

export type AuthUser = {
  sub: string;
  tenantId: string;
  role: MembershipRole;
  jti: string;
  exp: number;
  iat: number;
};

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
    tenant?: Pick<Tenant, 'id' | 'slug' | 'name'>;
  }
}
