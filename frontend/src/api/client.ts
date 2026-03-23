import { z } from 'zod';
import type { AuthPayload, Tokens } from '../types/auth';
import type {
  DocumentGrant,
  DocumentRecord,
  Invitation,
  Team,
  TenantMember,
} from '../types/collab';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

const authPayloadSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.email(),
  }),
  tenant: z.object({
    id: z.string(),
    slug: z.string(),
    role: z.enum(['owner', 'admin', 'member', 'guest']),
  }),
});

const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

async function post<T>(
  path: string,
  body: unknown,
  options?: { accessToken?: string; tenantSlug?: string },
): Promise<T> {
  return request<T>('POST', path, body, options);
}

async function get<T>(
  path: string,
  options?: { accessToken?: string; tenantSlug?: string },
): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

async function patch<T>(
  path: string,
  body: unknown,
  options?: { accessToken?: string; tenantSlug?: string },
): Promise<T> {
  return request<T>('PATCH', path, body, options);
}

async function del<T>(
  path: string,
  body: unknown,
  options?: { accessToken?: string; tenantSlug?: string },
): Promise<T> {
  return request<T>('DELETE', path, body, options);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: { accessToken?: string; tenantSlug?: string },
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options?.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : {}),
      ...(options?.tenantSlug ? { 'x-tenant-slug': options.tenantSlug } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({} as unknown));
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      throw new Error(parsed.data.error.message);
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return data as T;
}

export async function register(input: {
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<AuthPayload> {
  const data = await post<AuthPayload>('/auth/register', input);
  return authPayloadSchema.parse(data);
}

export async function login(input: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<AuthPayload> {
  const data = await post<AuthPayload>('/auth/login', input);
  return authPayloadSchema.parse(data);
}

export async function registerFromInvite(input: {
  email: string;
  password: string;
  token: string;
}): Promise<AuthPayload> {
  const data = await post<AuthPayload>('/auth/register-from-invite', input);
  return authPayloadSchema.parse(data);
}

export async function refresh(refreshToken: string): Promise<Tokens> {
  const data = await post<Tokens>('/auth/refresh', { refreshToken });
  return tokensSchema.parse(data);
}

export async function logout(
  refreshToken: string,
  accessToken?: string,
  tenantSlug?: string,
): Promise<void> {
  await post('/auth/logout', { refreshToken }, { accessToken, tenantSlug });
}

export async function listTenantMembers(input: {
  accessToken: string;
  tenantSlug: string;
}) {
  return get<TenantMember[]>('/tenant/members', input);
}

export async function updateTenantMemberRole(input: {
  accessToken: string;
  tenantSlug: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
}) {
  return patch<TenantMember>(
    `/tenant/members/${input.userId}/role`,
    { role: input.role },
    input,
  );
}

export async function removeTenantMember(input: {
  accessToken: string;
  tenantSlug: string;
  userId: string;
}) {
  return del<{ success: true }>(`/tenant/members/${input.userId}`, {}, input);
}

export async function listInvitations(input: {
  accessToken: string;
  tenantSlug: string;
}) {
  return get<Invitation[]>('/invitations', input);
}

export async function createInvitation(input: {
  accessToken: string;
  tenantSlug: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
  expiresInDays: number;
}) {
  return post<Invitation & { token: string }>(
    '/invitations',
    {
      email: input.email,
      role: input.role,
      expiresInDays: input.expiresInDays,
    },
    input,
  );
}

export async function revokeInvitation(input: {
  accessToken: string;
  tenantSlug: string;
  invitationId: string;
}) {
  return post<Invitation>(`/invitations/${input.invitationId}/revoke`, {}, input);
}

export async function acceptInvitation(input: {
  accessToken: string;
  tenantSlug: string;
  token: string;
}) {
  return post<{ success: true }>(
    '/invitations/accept',
    { token: input.token },
    input,
  );
}

export async function listTeams(input: { accessToken: string; tenantSlug: string }) {
  return get<Team[]>('/teams', input);
}

export async function createTeam(input: {
  accessToken: string;
  tenantSlug: string;
  name: string;
  slug?: string;
}) {
  return post<Team>('/teams', { name: input.name, slug: input.slug }, input);
}

export async function addTeamMember(input: {
  accessToken: string;
  tenantSlug: string;
  teamId: string;
  userId: string;
  role: 'lead' | 'member';
}) {
  return post(
    `/teams/${input.teamId}/members`,
    { userId: input.userId, role: input.role },
    input,
  );
}

export async function removeTeamMember(input: {
  accessToken: string;
  tenantSlug: string;
  teamId: string;
  userId: string;
}) {
  return del(`/teams/${input.teamId}/members/${input.userId}`, {}, input);
}

export async function deleteTeam(input: {
  accessToken: string;
  tenantSlug: string;
  teamId: string;
}) {
  return del(`/teams/${input.teamId}`, {}, input);
}

export async function listDocuments(input: {
  accessToken: string;
  tenantSlug: string;
}) {
  return get<DocumentRecord[]>('/documents', input);
}

export async function createDocument(input: {
  accessToken: string;
  tenantSlug: string;
  title: string;
  content: string;
  visibility: 'private' | 'team' | 'tenant';
}) {
  return post<DocumentRecord>(
    '/documents',
    {
      title: input.title,
      content: input.content,
      visibility: input.visibility,
    },
    input,
  );
}

export async function updateDocument(input: {
  accessToken: string;
  tenantSlug: string;
  documentId: string;
  title?: string;
  content?: string;
  visibility?: 'private' | 'team' | 'tenant';
}) {
  return patch<DocumentRecord>(
    `/documents/${input.documentId}`,
    {
      title: input.title,
      content: input.content,
      visibility: input.visibility,
    },
    input,
  );
}

export async function deleteDocument(input: {
  accessToken: string;
  tenantSlug: string;
  documentId: string;
}) {
  return del(`/documents/${input.documentId}`, {}, input);
}

export async function listDocumentGrants(input: {
  accessToken: string;
  tenantSlug: string;
  documentId: string;
}) {
  return get<DocumentGrant[]>(`/documents/${input.documentId}/grants`, input);
}

export async function grantDocumentPermission(input: {
  accessToken: string;
  tenantSlug: string;
  documentId: string;
  principalType: 'user' | 'team';
  principalId: string;
  permission: 'view' | 'edit' | 'admin';
}) {
  return post<DocumentGrant>(
    `/documents/${input.documentId}/grants`,
    {
      principalType: input.principalType,
      principalId: input.principalId,
      permission: input.permission,
    },
    input,
  );
}

export async function revokeDocumentPermission(input: {
  accessToken: string;
  tenantSlug: string;
  documentId: string;
  principalType: 'user' | 'team';
  principalId: string;
}) {
  return del(
    `/documents/${input.documentId}/grants`,
    {
      principalType: input.principalType,
      principalId: input.principalId,
    },
    input,
  );
}
