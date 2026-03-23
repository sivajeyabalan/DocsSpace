import { z } from 'zod';

const slugRegex = /^[a-z0-9-]+$/;

export const updateMembershipRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'guest']),
});

export const createInvitationSchema = z.object({
  email: z.email(),
  role: z.enum(['admin', 'member', 'guest']).default('member'),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16),
});

export const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(slugRegex).min(2).max(80).optional(),
  workspaceId: z.string().uuid().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().regex(slugRegex).min(2).max(80).optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['lead', 'member']).default('member'),
});

export const createDocumentSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  title: z.string().min(1).max(160),
  content: z.string().default(''),
  visibility: z.enum(['private', 'team', 'tenant']).default('private'),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  content: z.string().optional(),
  visibility: z.enum(['private', 'team', 'tenant']).optional(),
});

export const grantDocumentPermissionSchema = z.object({
  principalType: z.enum(['user', 'team']),
  principalId: z.string().uuid(),
  permission: z.enum(['view', 'edit', 'admin']),
});

export const revokeDocumentPermissionSchema = z.object({
  principalType: z.enum(['user', 'team']),
  principalId: z.string().uuid(),
});
