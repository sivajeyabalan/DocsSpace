import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? 'acme';
  const tenantName = process.env.SEED_TENANT_NAME ?? 'Acme Workspace';
  const userEmail = process.env.SEED_USER_EMAIL ?? 'owner@acme.local';
  const userPassword = process.env.SEED_USER_PASSWORD ?? 'Password123!';

  const passwordHash = await argon2.hash(userPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: {
      slug: tenantSlug,
      name: tenantName,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: { passwordHash },
    create: {
      email: userEmail,
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {
      role: 'owner',
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    },
  });

  await prisma.workspace.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'general',
      },
    },
    update: {
      name: 'General',
    },
    create: {
      tenantId: tenant.id,
      name: 'General',
      slug: 'general',
    },
  });

  console.log(
    `Seed complete: tenant=${tenant.slug}, user=${user.email}, password=${userPassword}`,
  );
}

void main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
