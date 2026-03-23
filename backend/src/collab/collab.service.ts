import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DocumentPermissionLevel,
  DocumentVisibility,
  InvitationRole,
  InvitationStatus,
  MembershipRole,
  PermissionPrincipalType,
  TeamRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationMailService } from './invitation-mail.service';

type CreateInvitationInput = {
  tenantId: string;
  invitedById: string;
  email: string;
  role: InvitationRole;
  expiresInDays: number;
};

@Injectable()
export class CollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationMailService: InvitationMailService,
  ) {}

  async listTenantMembers(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, email: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateTenantMemberRole(input: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    role: MembershipRole;
  }) {
    const actorMembership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.actorUserId,
          tenantId: input.tenantId,
        },
      },
    });

    if (!actorMembership) {
      throw new ForbiddenException('Actor is not a tenant member');
    }

    const targetMembership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.targetUserId,
          tenantId: input.tenantId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Target membership not found');
    }

    if (
      input.actorUserId === input.targetUserId &&
      targetMembership.role === 'owner' &&
      input.role !== 'owner'
    ) {
      throw new ForbiddenException('Owner cannot self-demote');
    }

    return this.prisma.membership.update({
      where: { id: targetMembership.id },
      data: { role: input.role },
    });
  }

  async removeTenantMember(input: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
  }) {
    const targetMembership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.targetUserId,
          tenantId: input.tenantId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Target membership not found');
    }

    if (
      input.actorUserId === input.targetUserId &&
      targetMembership.role === 'owner'
    ) {
      throw new ForbiddenException('Owner cannot remove own membership');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({
        where: {
          userId: input.targetUserId,
          team: {
            tenantId: input.tenantId,
          },
        },
      });

      await tx.documentPermission.deleteMany({
        where: {
          principalType: 'user',
          principalId: input.targetUserId,
          document: { tenantId: input.tenantId },
        },
      });

      await tx.membership.delete({
        where: { id: targetMembership.id },
      });
    });

    return { success: true };
  }

  async issueInvitation(input: CreateInvitationInput) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: input.tenantId,
        invitedById: input.invitedById,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: input.invitedById },
      select: { email: true },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true, slug: true },
    });

    const emailSent = await this.invitationMailService.sendInvitationEmail({
      to: invitation.email,
      tenantName: tenant?.name ?? 'DocSpace tenant',
      tenantSlug: tenant?.slug ?? '',
      inviterEmail: inviter?.email ?? 'unknown',
      role: invitation.role,
      token,
      expiresAt: invitation.expiresAt,
    });

    return { ...invitation, token, emailSent };
  }

  async listInvitations(tenantId: string) {
    return this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async revokeInvitation(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.revoked },
    });
  }

  async acceptInvitation(input: {
    tenantId: string;
    actorUserId: string;
    token: string;
  }) {
    const tokenHash = this.hashToken(input.token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.tenantId !== input.tenantId) {
      throw new UnauthorizedException('Invalid invitation token');
    }

    if (invitation.status !== InvitationStatus.pending) {
      throw new BadRequestException('Invitation is no longer active');
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.expired },
      });
      throw new BadRequestException('Invitation is expired');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { id: true, email: true },
    });

    if (!actor) {
      throw new UnauthorizedException('User not found');
    }

    if (actor.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'Invitation email does not match current user',
      );
    }

    const role = this.toMembershipRole(invitation.role);

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: {
          userId_tenantId: {
            userId: actor.id,
            tenantId: invitation.tenantId,
          },
        },
        create: {
          userId: actor.id,
          tenantId: invitation.tenantId,
          role,
        },
        update: {
          role,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.accepted,
          acceptedAt: new Date(),
        },
      });
    });

    return { success: true };
  }

  async createTeam(input: {
    tenantId: string;
    actorUserId: string;
    name: string;
    slug?: string;
    workspaceId?: string;
  }) {
    const workspaceId =
      input.workspaceId ??
      (await this.ensureDefaultWorkspace(input.tenantId)).id;

    if (input.workspaceId) {
      await this.ensureWorkspaceInTenant(input.workspaceId, input.tenantId);
    }

    const slug = input.slug ?? this.slugify(input.name);

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          tenantId: input.tenantId,
          workspaceId,
          name: input.name,
          slug,
        },
      });

      await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: input.actorUserId,
          },
        },
        create: {
          teamId: team.id,
          userId: input.actorUserId,
          role: TeamRole.lead,
        },
        update: {
          role: TeamRole.lead,
        },
      });

      return team;
    });
  }

  async listTeams(tenantId: string) {
    return this.prisma.team.findMany({
      where: { tenantId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTeam(input: {
    tenantId: string;
    teamId: string;
    name?: string;
    slug?: string;
  }) {
    const team = await this.prisma.team.findFirst({
      where: { id: input.teamId, tenantId: input.tenantId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.prisma.team.update({
      where: { id: team.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
      },
    });
  }

  async deleteTeam(tenantId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.prisma.team.delete({
      where: { id: team.id },
    });

    return { success: true };
  }

  async addTeamMember(input: {
    tenantId: string;
    teamId: string;
    userId: string;
    role: TeamRole;
  }) {
    const team = await this.prisma.team.findFirst({
      where: { id: input.teamId, tenantId: input.tenantId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('User must be a tenant member first');
    }

    return this.prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: input.teamId,
          userId: input.userId,
        },
      },
      create: {
        teamId: input.teamId,
        userId: input.userId,
        role: input.role,
      },
      update: {
        role: input.role,
      },
    });
  }

  async removeTeamMember(input: {
    tenantId: string;
    teamId: string;
    userId: string;
  }) {
    const team = await this.prisma.team.findFirst({
      where: { id: input.teamId, tenantId: input.tenantId },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.prisma.teamMember.deleteMany({
      where: {
        teamId: input.teamId,
        userId: input.userId,
      },
    });

    return { success: true };
  }

  async createDocument(input: {
    tenantId: string;
    ownerId: string;
    workspaceId?: string;
    title: string;
    content: string;
    visibility: DocumentVisibility;
  }) {
    const workspaceId =
      input.workspaceId ??
      (await this.ensureDefaultWorkspace(input.tenantId)).id;

    if (input.workspaceId) {
      await this.ensureWorkspaceInTenant(input.workspaceId, input.tenantId);
    }

    return this.prisma.document.create({
      data: {
        tenantId: input.tenantId,
        workspaceId,
        ownerId: input.ownerId,
        title: input.title,
        content: input.content,
        visibility: input.visibility,
      },
    });
  }

  async listDocuments(tenantId: string, userId: string) {
    const documents = await this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    const result = [];
    for (const document of documents) {
      const canView = await this.hasDocumentPermission({
        tenantId,
        userId,
        documentId: document.id,
        required: DocumentPermissionLevel.view,
      });
      if (canView) {
        result.push(document);
      }
    }

    return result;
  }

  async getDocument(tenantId: string, userId: string, documentId: string) {
    const canView = await this.hasDocumentPermission({
      tenantId,
      userId,
      documentId,
      required: DocumentPermissionLevel.view,
    });
    if (!canView) {
      throw new ForbiddenException('Access denied');
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async updateDocument(input: {
    tenantId: string;
    userId: string;
    documentId: string;
    title?: string;
    content?: string;
    visibility?: DocumentVisibility;
  }) {
    const canEdit = await this.hasDocumentPermission({
      tenantId: input.tenantId,
      userId: input.userId,
      documentId: input.documentId,
      required: DocumentPermissionLevel.edit,
    });
    if (!canEdit) {
      throw new ForbiddenException('Access denied');
    }

    const document = await this.prisma.document.findFirst({
      where: { id: input.documentId, tenantId: input.tenantId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.document.update({
      where: { id: input.documentId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.visibility !== undefined
          ? { visibility: input.visibility }
          : {}),
      },
    });
  }

  async deleteDocument(input: {
    tenantId: string;
    userId: string;
    documentId: string;
  }) {
    const canAdmin = await this.hasDocumentPermission({
      tenantId: input.tenantId,
      userId: input.userId,
      documentId: input.documentId,
      required: DocumentPermissionLevel.admin,
    });
    if (!canAdmin) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.document.delete({
      where: { id: input.documentId },
    });

    return { success: true };
  }

  async grantDocumentPermission(input: {
    tenantId: string;
    actorUserId: string;
    documentId: string;
    principalType: PermissionPrincipalType;
    principalId: string;
    permission: DocumentPermissionLevel;
  }) {
    const canAdmin = await this.hasDocumentPermission({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      documentId: input.documentId,
      required: DocumentPermissionLevel.admin,
    });
    if (!canAdmin) {
      throw new ForbiddenException('Access denied');
    }

    await this.ensurePrincipalInTenant(
      input.tenantId,
      input.principalType,
      input.principalId,
    );

    return this.prisma.documentPermission.upsert({
      where: {
        documentId_principalType_principalId: {
          documentId: input.documentId,
          principalType: input.principalType,
          principalId: input.principalId,
        },
      },
      create: {
        documentId: input.documentId,
        principalType: input.principalType,
        principalId: input.principalId,
        permission: input.permission,
      },
      update: {
        permission: input.permission,
      },
    });
  }

  async revokeDocumentPermission(input: {
    tenantId: string;
    actorUserId: string;
    documentId: string;
    principalType: PermissionPrincipalType;
    principalId: string;
  }) {
    const canAdmin = await this.hasDocumentPermission({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      documentId: input.documentId,
      required: DocumentPermissionLevel.admin,
    });
    if (!canAdmin) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.documentPermission.deleteMany({
      where: {
        documentId: input.documentId,
        principalType: input.principalType,
        principalId: input.principalId,
      },
    });

    return { success: true };
  }

  async listDocumentPermissions(tenantId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.documentPermission.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensureWorkspaceInTenant(workspaceId: string, tenantId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  private async ensureDefaultWorkspace(tenantId: string) {
    const existing = await this.prisma.workspace.findFirst({
      where: { tenantId, slug: 'general' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.workspace.create({
      data: {
        tenantId,
        name: 'General',
        slug: 'general',
      },
    });
  }

  private async ensurePrincipalInTenant(
    tenantId: string,
    principalType: PermissionPrincipalType,
    principalId: string,
  ) {
    if (principalType === PermissionPrincipalType.user) {
      const member = await this.prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: principalId,
            tenantId,
          },
        },
      });
      if (!member) {
        throw new BadRequestException('User is not part of this tenant');
      }
      return;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: principalId,
        tenantId,
      },
    });
    if (!team) {
      throw new BadRequestException('Team not found in this tenant');
    }
  }

  private async hasDocumentPermission(input: {
    tenantId: string;
    userId: string;
    documentId: string;
    required: DocumentPermissionLevel;
  }) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        tenantId: input.tenantId,
      },
      select: {
        id: true,
        ownerId: true,
        workspaceId: true,
        visibility: true,
      },
    });

    if (!document) {
      return false;
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      return false;
    }

    if (
      membership.role === MembershipRole.owner ||
      membership.role === MembershipRole.admin
    ) {
      return true;
    }

    if (document.ownerId === input.userId) {
      return true;
    }

    const directPermission = await this.prisma.documentPermission.findFirst({
      where: {
        documentId: document.id,
        principalType: PermissionPrincipalType.user,
        principalId: input.userId,
      },
      select: { permission: true },
    });

    if (
      directPermission &&
      this.permissionRank(directPermission.permission) >=
        this.permissionRank(input.required)
    ) {
      return true;
    }

    const teamMemberships = await this.prisma.teamMember.findMany({
      where: {
        userId: input.userId,
        team: {
          tenantId: input.tenantId,
        },
      },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map((item) => item.teamId);

    if (teamIds.length > 0) {
      const teamPermission = await this.prisma.documentPermission.findFirst({
        where: {
          documentId: document.id,
          principalType: PermissionPrincipalType.team,
          principalId: { in: teamIds },
        },
        select: { permission: true },
      });

      if (
        teamPermission &&
        this.permissionRank(teamPermission.permission) >=
          this.permissionRank(input.required)
      ) {
        return true;
      }
    }

    if (input.required === DocumentPermissionLevel.view) {
      if (document.visibility === DocumentVisibility.tenant) {
        return true;
      }

      if (
        document.visibility === DocumentVisibility.team &&
        teamIds.length > 0
      ) {
        return true;
      }
    }

    return false;
  }

  private permissionRank(level: DocumentPermissionLevel) {
    if (level === DocumentPermissionLevel.view) {
      return 1;
    }
    if (level === DocumentPermissionLevel.edit) {
      return 2;
    }
    return 3;
  }

  private toMembershipRole(role: InvitationRole): MembershipRole {
    switch (role) {
      case InvitationRole.admin:
        return MembershipRole.admin;
      case InvitationRole.member:
        return MembershipRole.member;
      case InvitationRole.guest:
        return MembershipRole.guest;
      default:
        return MembershipRole.member;
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
