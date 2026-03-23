import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InvitationStatus, MembershipRole, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginInput,
  RefreshInput,
  RegisterFromInviteInput,
  RegisterInput,
} from './auth.schema';

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  tenant: { id: string; slug: string; role: MembershipRole };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await this.hashPassword(input.password);
    const familyId = randomUUID();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            name: input.tenantName,
            slug: input.tenantSlug,
          },
        });

        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: 'owner',
          },
        });

        const refreshToken = await this.createRefreshToken(tx, {
          userId: user.id,
          tenantId: tenant.id,
          familyId,
        });

        const accessToken = await this.issueAccessToken({
          sub: user.id,
          tenantId: tenant.id,
          role: membership.role,
          jti: randomUUID(),
        });

        return {
          accessToken,
          refreshToken,
          user: { id: user.id, email: user.email },
          tenant: { id: tenant.id, slug: tenant.slug, role: membership.role },
        };
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException('Email or tenant slug already exists');
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenant.id,
        },
      },
    });
    if (!membership) {
      throw new UnauthorizedException('No active membership for this tenant');
    }

    const familyId = randomUUID();
    const refreshToken = await this.createRefreshToken(this.prisma, {
      userId: user.id,
      tenantId: tenant.id,
      familyId,
    });

    const accessToken = await this.issueAccessToken({
      sub: user.id,
      tenantId: tenant.id,
      role: membership.role,
      jti: randomUUID(),
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
      tenant: { id: tenant.id, slug: tenant.slug, role: membership.role },
    };
  }

  async registerFromInvite(
    input: RegisterFromInviteInput,
  ): Promise<AuthResult> {
    const passwordHash = await this.hashPassword(input.password);
    const tokenHash = this.hashToken(input.token);
    const familyId = randomUUID();

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (invitation.status !== InvitationStatus.pending) {
      throw new BadRequestException('Invitation is no longer active');
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.expired },
      });
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email.toLowerCase() !== input.email.toLowerCase()) {
      throw new BadRequestException('Invitation email does not match');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException(
        'User already exists. Please login and accept invitation from inside tenant context.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
        },
      });

      const role = this.invitationRoleToMembershipRole(invitation.role);

      const membership = await tx.membership.upsert({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: invitation.tenantId,
          },
        },
        create: {
          userId: user.id,
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

      const tenant = await tx.tenant.findUnique({
        where: { id: invitation.tenantId },
        select: { id: true, slug: true },
      });

      if (!tenant) {
        throw new BadRequestException('Tenant not found for invitation');
      }

      const refreshToken = await this.createRefreshToken(tx, {
        userId: user.id,
        tenantId: tenant.id,
        familyId,
      });

      const accessToken = await this.issueAccessToken({
        sub: user.id,
        tenantId: tenant.id,
        role: membership.role,
        jti: randomUUID(),
      });

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
        tenant: { id: tenant.id, slug: tenant.slug, role: membership.role },
      };
    });
  }

  async refresh(
    input: RefreshInput,
  ): Promise<Pick<AuthResult, 'accessToken' | 'refreshToken'>> {
    const tokenHash = this.hashToken(input.refreshToken);
    const currentToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!currentToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (currentToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: {
          familyId: currentToken.familyId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (currentToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: currentToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: currentToken.userId,
          tenantId: currentToken.tenantId,
        },
      },
    });
    if (!membership) {
      throw new UnauthorizedException('Membership not found');
    }

    const nextRefreshToken = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: currentToken.id },
        data: { revokedAt: new Date() },
      });
      return this.createRefreshToken(tx, {
        userId: currentToken.userId,
        tenantId: currentToken.tenantId,
        familyId: currentToken.familyId,
      });
    });

    const accessToken = await this.issueAccessToken({
      sub: currentToken.userId,
      tenantId: currentToken.tenantId,
      role: membership.role,
      jti: randomUUID(),
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async issueAccessToken(payload: {
    sub: string;
    tenantId: string;
    role: MembershipRole;
    jti: string;
  }): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'ACCESS_TOKEN_TTL',
      ) as never,
    });
  }

  private async createRefreshToken(
    prisma: Prisma.TransactionClient | PrismaService,
    input: { userId: string; tenantId: string; familyId: string },
  ): Promise<string> {
    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenTtlDays = this.configService.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_DAYS',
    );
    const expiresAt = new Date(
      Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        familyId: input.familyId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return refreshToken;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private invitationRoleToMembershipRole(role: string): MembershipRole {
    if (role === 'admin') {
      return 'admin';
    }
    if (role === 'guest') {
      return 'guest';
    }
    return 'member';
  }
}
