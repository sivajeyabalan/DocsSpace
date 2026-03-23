export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  tenant: {
    id: string;
    slug: string;
    role: 'owner' | 'admin' | 'member' | 'guest';
  };
};

export type Tokens = Pick<AuthPayload, 'accessToken' | 'refreshToken'>;
