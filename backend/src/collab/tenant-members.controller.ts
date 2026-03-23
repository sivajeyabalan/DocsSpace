import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { RoleGuard } from '../auth/role.guard';
import { TenantMembershipGuard } from '../auth/tenant-membership.guard';
import { updateMembershipRoleSchema } from './collab.schema';
import { CollabService } from './collab.service';
import type { RequestWithTenantAuth } from './request.types';

@Controller('tenant/members')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class TenantMembersController {
  constructor(private readonly collabService: CollabService) {}

  @Get()
  async list(@Req() req: RequestWithTenantAuth) {
    return this.collabService.listTenantMembers(req.tenant!.id);
  }

  @Patch(':userId/role')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async updateRole(
    @Req() req: RequestWithTenantAuth,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateMembershipRoleSchema.parse(body);
    return this.collabService.updateTenantMemberRole({
      tenantId: req.tenant!.id,
      actorUserId: req.authUser!.sub,
      targetUserId: userId,
      role: parsed.role,
    });
  }

  @Delete(':userId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async remove(
    @Req() req: RequestWithTenantAuth,
    @Param('userId') userId: string,
  ) {
    return this.collabService.removeTenantMember({
      tenantId: req.tenant!.id,
      actorUserId: req.authUser!.sub,
      targetUserId: userId,
    });
  }
}
