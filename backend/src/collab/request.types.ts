import type { Request } from 'express';

export type RequestWithTenantAuth = Request & {
  authUser?: {
    sub: string;
    tenantId: string;
    role: 'owner' | 'admin' | 'member' | 'guest';
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
