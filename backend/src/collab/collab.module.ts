import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CollabService } from './collab.service';
import { DocumentsController } from './documents.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationMailService } from './invitation-mail.service';
import { TeamsController } from './teams.controller';
import { TenantMembersController } from './tenant-members.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CollabService, InvitationMailService],
  controllers: [
    TenantMembersController,
    InvitationsController,
    TeamsController,
    DocumentsController,
  ],
})
export class CollabModule {}
