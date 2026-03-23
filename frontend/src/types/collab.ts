export type TenantMember = {
  id: string;
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
};

export type Invitation = {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
  };
};

export type Team = {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  slug: string;
  createdAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  teamMembers: Array<{
    id: string;
    teamId: string;
    userId: string;
    role: 'lead' | 'member';
    createdAt: string;
    user: {
      id: string;
      email: string;
    };
  }>;
};

export type DocumentRecord = {
  id: string;
  tenantId: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: 'private' | 'team' | 'tenant';
  createdAt: string;
  updatedAt: string;
};

export type DocumentGrant = {
  id: string;
  documentId: string;
  principalType: 'user' | 'team';
  principalId: string;
  permission: 'view' | 'edit' | 'admin';
  createdAt: string;
};
