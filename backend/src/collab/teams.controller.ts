import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole, TeamRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { RoleGuard } from '../auth/role.guard';
import { TenantMembershipGuard } from '../auth/tenant-membership.guard';
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateTeamSchema,
} from './collab.schema';
import { CollabService } from './collab.service';
import type { RequestWithTenantAuth } from './request.types';

@Controller('teams')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class TeamsController {
  constructor(private readonly collabService: CollabService) {}

  @Get()
  async list(@Req() req: RequestWithTenantAuth) {
    return this.collabService.listTeams(req.tenant!.id);
  }

  @Post()
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async create(@Req() req: RequestWithTenantAuth, @Body() body: unknown) {
    const parsed = createTeamSchema.parse(body);
    return this.collabService.createTeam({
      tenantId: req.tenant!.id,
      actorUserId: req.authUser!.sub,
      name: parsed.name,
      slug: parsed.slug,
      workspaceId: parsed.workspaceId,
    });
  }

  @Patch(':teamId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async update(
    @Req() req: RequestWithTenantAuth,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateTeamSchema.parse(body);
    return this.collabService.updateTeam({
      tenantId: req.tenant!.id,
      teamId,
      name: parsed.name,
      slug: parsed.slug,
    });
  }

  @Delete(':teamId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async remove(
    @Req() req: RequestWithTenantAuth,
    @Param('teamId') teamId: string,
  ) {
    return this.collabService.deleteTeam(req.tenant!.id, teamId);
  }

  @Post(':teamId/members')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async addMember(
    @Req() req: RequestWithTenantAuth,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ) {
    const parsed = addTeamMemberSchema.parse(body);
    return this.collabService.addTeamMember({
      tenantId: req.tenant!.id,
      teamId,
      userId: parsed.userId,
      role: parsed.role as TeamRole,
    });
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.owner, MembershipRole.admin)
  async removeMember(
    @Req() req: RequestWithTenantAuth,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.collabService.removeTeamMember({
      tenantId: req.tenant!.id,
      teamId,
      userId,
    });
  }
}
