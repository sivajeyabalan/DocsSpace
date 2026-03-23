import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export const RequireRole = (...roles: MembershipRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
