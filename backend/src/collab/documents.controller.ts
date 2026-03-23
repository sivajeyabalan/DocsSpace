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
import {
  DocumentPermissionLevel,
  DocumentVisibility,
  PermissionPrincipalType,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/tenant-membership.guard';
import {
  createDocumentSchema,
  grantDocumentPermissionSchema,
  revokeDocumentPermissionSchema,
  updateDocumentSchema,
} from './collab.schema';
import { CollabService } from './collab.service';
import type { RequestWithTenantAuth } from './request.types';

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class DocumentsController {
  constructor(private readonly collabService: CollabService) {}

  @Get()
  async list(@Req() req: RequestWithTenantAuth) {
    return this.collabService.listDocuments(req.tenant!.id, req.authUser!.sub);
  }

  @Post()
  async create(@Req() req: RequestWithTenantAuth, @Body() body: unknown) {
    const parsed = createDocumentSchema.parse(body);
    return this.collabService.createDocument({
      tenantId: req.tenant!.id,
      ownerId: req.authUser!.sub,
      workspaceId: parsed.workspaceId,
      title: parsed.title,
      content: parsed.content,
      visibility: parsed.visibility as DocumentVisibility,
    });
  }

  @Get(':documentId')
  async get(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
  ) {
    return this.collabService.getDocument(
      req.tenant!.id,
      req.authUser!.sub,
      documentId,
    );
  }

  @Get(':documentId/grants')
  async grants(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
  ) {
    return this.collabService.listDocumentPermissions(
      req.tenant!.id,
      documentId,
    );
  }

  @Patch(':documentId')
  async update(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateDocumentSchema.parse(body);
    return this.collabService.updateDocument({
      tenantId: req.tenant!.id,
      userId: req.authUser!.sub,
      documentId,
      title: parsed.title,
      content: parsed.content,
      visibility: parsed.visibility as DocumentVisibility | undefined,
    });
  }

  @Delete(':documentId')
  async remove(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
  ) {
    return this.collabService.deleteDocument({
      tenantId: req.tenant!.id,
      userId: req.authUser!.sub,
      documentId,
    });
  }

  @Post(':documentId/grants')
  async grant(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ) {
    const parsed = grantDocumentPermissionSchema.parse(body);
    return this.collabService.grantDocumentPermission({
      tenantId: req.tenant!.id,
      actorUserId: req.authUser!.sub,
      documentId,
      principalType: parsed.principalType as PermissionPrincipalType,
      principalId: parsed.principalId,
      permission: parsed.permission as DocumentPermissionLevel,
    });
  }

  @Delete(':documentId/grants')
  async revoke(
    @Req() req: RequestWithTenantAuth,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ) {
    const parsed = revokeDocumentPermissionSchema.parse(body);
    return this.collabService.revokeDocumentPermission({
      tenantId: req.tenant!.id,
      actorUserId: req.authUser!.sub,
      documentId,
      principalType: parsed.principalType as PermissionPrincipalType,
      principalId: parsed.principalId,
    });
  }
}
