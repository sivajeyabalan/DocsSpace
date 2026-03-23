/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: Date;
};

type User = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: Date;
};

type Membership = {
  id: string;
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: Date;
};

type RefreshToken = {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

class FakePrismaService {
  private readonly tenants: Tenant[] = [];
  private readonly users: User[] = [];
  private readonly memberships: Membership[] = [];
  private readonly refreshTokens: RefreshToken[] = [];

  readonly tenant = {
    findUnique: async (args: {
      where: { slug?: string; id?: string };
      select?: { id?: boolean; slug?: boolean; name?: boolean };
    }) => {
      const tenant =
        this.tenants.find((item) => item.slug === args.where.slug) ??
        this.tenants.find((item) => item.id === args.where.id) ??
        null;

      if (!tenant || !args.select) {
        return tenant;
      }

      return {
        ...(args.select.id ? { id: tenant.id } : {}),
        ...(args.select.slug ? { slug: tenant.slug } : {}),
        ...(args.select.name ? { name: tenant.name } : {}),
      };
    },
    create: async (args: { data: { name: string; slug: string } }) => {
      const tenant: Tenant = {
        id: randomUUID(),
        name: args.data.name,
        slug: args.data.slug,
        plan: 'free',
        createdAt: new Date(),
      };
      this.tenants.push(tenant);
      return tenant;
    },
    upsert: async (args: {
      where: { slug: string };
      create: { name: string; slug: string };
      update: { name: string };
    }) => {
      const existing = this.tenants.find(
        (item) => item.slug === args.where.slug,
      );
      if (existing) {
        existing.name = args.update.name;
        return existing;
      }
      return this.tenant.create({ data: args.create });
    },
  };

  readonly user = {
    findUnique: async (args: { where: { email: string } }) => {
      return this.users.find((item) => item.email === args.where.email) ?? null;
    },
    create: async (args: { data: { email: string; passwordHash: string } }) => {
      const user: User = {
        id: randomUUID(),
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        emailVerified: false,
        createdAt: new Date(),
      };
      this.users.push(user);
      return user;
    },
    upsert: async (args: {
      where: { email: string };
      create: { email: string; passwordHash: string };
      update: { passwordHash: string };
    }) => {
      const existing = this.users.find(
        (item) => item.email === args.where.email,
      );
      if (existing) {
        existing.passwordHash = args.update.passwordHash;
        return existing;
      }
      return this.user.create({ data: args.create });
    },
  };

  readonly membership = {
    findUnique: async (args: {
      where: { userId_tenantId: { userId: string; tenantId: string } };
    }) => {
      return (
        this.memberships.find(
          (item) =>
            item.userId === args.where.userId_tenantId.userId &&
            item.tenantId === args.where.userId_tenantId.tenantId,
        ) ?? null
      );
    },
    create: async (args: {
      data: {
        userId: string;
        tenantId: string;
        role: 'owner' | 'admin' | 'member' | 'guest';
      };
    }) => {
      const membership: Membership = {
        id: randomUUID(),
        userId: args.data.userId,
        tenantId: args.data.tenantId,
        role: args.data.role,
        joinedAt: new Date(),
      };
      this.memberships.push(membership);
      return membership;
    },
    upsert: async (args: {
      where: { userId_tenantId: { userId: string; tenantId: string } };
      create: {
        userId: string;
        tenantId: string;
        role: 'owner' | 'admin' | 'member' | 'guest';
      };
      update: { role: 'owner' | 'admin' | 'member' | 'guest' };
    }) => {
      const existing = await this.membership.findUnique({
        where: args.where,
      });

      if (existing) {
        existing.role = args.update.role;
        return existing;
      }

      return this.membership.create({ data: args.create });
    },
  };

  readonly refreshToken = {
    findUnique: async (args: { where: { tokenHash: string } }) => {
      return (
        this.refreshTokens.find(
          (item) => item.tokenHash === args.where.tokenHash,
        ) ?? null
      );
    },
    create: async (args: {
      data: {
        userId: string;
        tenantId: string;
        familyId: string;
        tokenHash: string;
        expiresAt: Date;
      };
    }) => {
      const token: RefreshToken = {
        id: randomUUID(),
        userId: args.data.userId,
        tenantId: args.data.tenantId,
        tokenHash: args.data.tokenHash,
        familyId: args.data.familyId,
        expiresAt: args.data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      this.refreshTokens.push(token);
      return token;
    },
    update: async (args: {
      where: { id: string };
      data: { revokedAt: Date };
    }) => {
      const token = this.refreshTokens.find(
        (item) => item.id === args.where.id,
      );
      if (!token) {
        throw new Error('Token not found');
      }
      token.revokedAt = args.data.revokedAt;
      return token;
    },
    updateMany: async (args: {
      where: {
        tokenHash?: string;
        familyId?: string;
        revokedAt?: null;
      };
      data: { revokedAt: Date };
    }) => {
      let count = 0;
      for (const token of this.refreshTokens) {
        if (
          (args.where.tokenHash === undefined ||
            token.tokenHash === args.where.tokenHash) &&
          (args.where.familyId === undefined ||
            token.familyId === args.where.familyId) &&
          (args.where.revokedAt === undefined ||
            token.revokedAt === args.where.revokedAt)
        ) {
          token.revokedAt = args.data.revokedAt;
          count += 1;
        }
      }
      return { count };
    },
  };

  async $transaction<T>(
    callback: (client: FakePrismaService) => Promise<T>,
  ): Promise<T> {
    return callback(this);
  }
}

describe('Auth + Tenant integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.DATABASE_URL =
      'mysql://docspace:docspace@localhost:3306/docspace_test';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.ACCESS_TOKEN_TTL = '15m';
    process.env.REFRESH_TOKEN_TTL_DAYS = '7';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
  });

  afterEach(async () => {
    await app.close();
  });

  async function createApp() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }

  it('GET /api/health returns status ok', async () => {
    await createApp();

    await request(app.getHttpServer()).get('/api/health').expect(200).expect({
      status: 'ok',
    });
  });

  it('register -> login -> refresh -> logout flow works', async () => {
    await createApp();

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner@example.com',
        password: 'Password123!',
        tenantName: 'Acme Inc',
        tenantSlug: 'acme-inc',
      })
      .expect(201);

    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.refreshToken).toBeDefined();
    expect(registerRes.body.tenant.slug).toBe('acme-inc');

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'Password123!',
        tenantSlug: 'acme-inc',
      })
      .expect(201);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('x-tenant-slug', 'acme-inc')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(201)
      .expect({ success: true });
  });

  it('refresh replay is detected and family gets revoked', async () => {
    await createApp();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner+replay@example.com',
        password: 'Password123!',
        tenantName: 'Replay Inc',
        tenantSlug: 'replay-inc',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'owner+replay@example.com',
        password: 'Password123!',
        tenantSlug: 'replay-inc',
      })
      .expect(201);

    const initialRefresh = loginRes.body.refreshToken as string;

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefresh })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefresh })
      .expect(401)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
        expect(res.body.error.message).toContain('reuse');
      });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });
  });

  it('blocks login after 5 attempts in 15 minutes for same IP', async () => {
    await createApp();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner+ratelimit@example.com',
        password: 'Password123!',
        tenantName: 'Rate Inc',
        tenantSlug: 'rate-inc',
      })
      .expect(201);

    const ip = '198.51.100.42';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-forwarded-for', ip)
        .send({
          email: 'owner+ratelimit@example.com',
          password: 'WrongPassword123!',
          tenantSlug: 'rate-inc',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', ip)
      .send({
        email: 'owner+ratelimit@example.com',
        password: 'WrongPassword123!',
        tenantSlug: 'rate-inc',
      })
      .expect(429)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('RATE_LIMITED');
      });
  });

  it('enforces tenant context and tenant-token match on protected route', async () => {
    await createApp();

    const firstUser = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner+tenant1@example.com',
        password: 'Password123!',
        tenantName: 'Tenant One',
        tenantSlug: 'tenant-one',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner+tenant2@example.com',
        password: 'Password123!',
        tenantName: 'Tenant Two',
        tenantSlug: 'tenant-two',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('authorization', `Bearer ${firstUser.body.accessToken}`)
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('authorization', `Bearer ${firstUser.body.accessToken}`)
      .set('x-tenant-slug', 'tenant-two')
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('authorization', `Bearer ${firstUser.body.accessToken}`)
      .set('x-tenant-slug', 'tenant-one')
      .expect(200)
      .expect((res) => {
        expect(res.body.tenant.slug).toBe('tenant-one');
      });
  });
});
