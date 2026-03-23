/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';

describe('ACL Matrix (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.setTimeout(120000);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register-from-invite creates a new user directly in invited tenant', async () => {
    const seed = randomUUID().slice(0, 8);
    const tenantSlug = `invite-${seed}`;
    const ownerEmail = `owner-invite+${seed}@example.com`;
    const invitedEmail = `invited+${seed}@example.com`;

    const ownerRegister = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'Password123!',
        tenantName: `Tenant ${seed}`,
        tenantSlug,
      })
      .expect(201);

    const invite = await request(app.getHttpServer())
      .post('/api/invitations')
      .set(
        'authorization',
        `Bearer ${ownerRegister.body.accessToken as string}`,
      )
      .set('x-tenant-slug', tenantSlug)
      .send({
        email: invitedEmail,
        role: 'member',
        expiresInDays: 7,
      })
      .expect(201);

    const registerFromInvite = await request(app.getHttpServer())
      .post('/api/auth/register-from-invite')
      .send({
        email: invitedEmail,
        password: 'Password123!',
        token: invite.body.token,
      })
      .expect(201);

    expect(registerFromInvite.body.tenant.slug).toBe(tenantSlug);
    expect(registerFromInvite.body.user.email).toBe(invitedEmail);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: invitedEmail,
        password: 'Password123!',
        tenantSlug,
      })
      .expect(201);
  }, 120000);

  it('covers owner/admin bypass, direct grants, team grants, and visibility fallback', async () => {
    const seed = randomUUID().slice(0, 8);
    const tenantSlug = `acl-${seed}`;
    const ownerEmail = `owner+${seed}@example.com`;
    const userEmail = `member+${seed}@example.com`;

    const ownerRegister = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'Password123!',
        tenantName: `Tenant ${seed}`,
        tenantSlug,
      })
      .expect(201);

    const ownerToken = ownerRegister.body.accessToken as string;
    const ownerUserId = ownerRegister.body.user.id as string;

    const userRegister = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userEmail,
        password: 'Password123!',
        tenantName: `Other ${seed}`,
        tenantSlug: `other-${seed}`,
      })
      .expect(201);

    const userId = userRegister.body.user.id as string;

    const invite = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        email: userEmail,
        role: 'member',
        expiresInDays: 7,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/invitations/accept')
      .set('authorization', `Bearer ${userRegister.body.accessToken as string}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ token: invite.body.token })
      .expect(201);

    const userLoginToTenant = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: userEmail,
        password: 'Password123!',
        tenantSlug,
      })
      .expect(201);

    const userToken = userLoginToTenant.body.accessToken as string;

    const team = await request(app.getHttpServer())
      .post('/api/teams')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ name: `Team ${seed}` })
      .expect(201);
    const teamId = team.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/teams/${teamId}/members`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ userId, role: 'member' })
      .expect(201);

    const adminBypassDoc = await request(app.getHttpServer())
      .post('/api/documents')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        title: `Admin bypass ${seed}`,
        content: 'private content',
        visibility: 'private',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/tenant/members/${userId}/role`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ role: 'admin' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/documents/${adminBypassDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/tenant/members/${userId}/role`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ role: 'member' })
      .expect(200);

    const directDoc = await request(app.getHttpServer())
      .post('/api/documents')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        title: `Direct ${seed}`,
        content: 'private content',
        visibility: 'private',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/documents/${directDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/documents/${directDoc.body.id}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        principalType: 'user',
        principalId: userId,
        permission: 'view',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/documents/${directDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/documents/${directDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ content: 'attempt edit without edit permission' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/documents/${directDoc.body.id}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        principalType: 'user',
        principalId: userId,
        permission: 'edit',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/documents/${directDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ content: 'edit allowed via direct edit permission' })
      .expect(200);

    const teamDoc = await request(app.getHttpServer())
      .post('/api/documents')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        title: `Team ${seed}`,
        content: 'team protected',
        visibility: 'private',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/documents/${teamDoc.body.id}/grants`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        principalType: 'team',
        principalId: teamId,
        permission: 'edit',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/documents/${teamDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ content: 'edit allowed via team permission' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/teams/${teamId}/members/${userId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/documents/${teamDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(403);

    const tenantDoc = await request(app.getHttpServer())
      .post('/api/documents')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        title: `Tenant visibility ${seed}`,
        content: 'tenant-wide',
        visibility: 'tenant',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/documents/${tenantDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/teams/${teamId}/members`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({ userId, role: 'member' })
      .expect(201);

    const teamVisibilityDoc = await request(app.getHttpServer())
      .post('/api/documents')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .send({
        title: `Team visibility ${seed}`,
        content: 'team visibility',
        visibility: 'team',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/documents/${teamVisibilityDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/teams/${teamId}/members/${userId}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/documents/${teamVisibilityDoc.body.id}`)
      .set('authorization', `Bearer ${userToken}`)
      .set('x-tenant-slug', tenantSlug)
      .expect(403);

    expect(ownerUserId).not.toBe(userId);
  }, 120000);
});
