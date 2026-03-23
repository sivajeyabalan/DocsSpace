import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InvitationRole, MembershipRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { RoleGuard } from '../auth/role.guard';
import { TenantMembershipGuard } from '../auth/tenant-membership.guard';
import {
  acceptInvitationSchema,
  createInvitationSchema,
} from './collab.schema';
import { CollabService } from './collab.service';
import type { RequestWithTenantAuth } from './request.types';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly collabService: CollabService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async list(@Req() req: RequestWithTenantAuth) {
    return this.collabService.listInvitations(req.tenant!.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantMembershipGuard, RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async create(@Req() req: RequestWithTenantAuth, @Body() body: unknown) {
    const parsed = createInvitationSchema.parse(body);
    return this.collabService.issueInvitation({
      tenantId: req.tenant!.id,
      invitedById: req.authUser!.sub,
      email: parsed.email,
      role: parsed.role as InvitationRole,
      expiresInDays: parsed.expiresInDays,
    });
  }

  @Post(':invitationId/revoke')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard, RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async revoke(
    @Req() req: RequestWithTenantAuth,
    @Param('invitationId') invitationId: string,
  ) {
    return this.collabService.revokeInvitation(req.tenant!.id, invitationId);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  async accept(@Req() req: RequestWithTenantAuth, @Body() body: unknown) {
    const parsed = acceptInvitationSchema.parse(body);
    if (!req.tenant) {
      throw new BadRequestException('Tenant context required');
    }
    return this.collabService.acceptInvitation({
      tenantId: req.tenant.id,
      actorUserId: req.authUser!.sub,
      token: parsed.token,
    });
  }
}
