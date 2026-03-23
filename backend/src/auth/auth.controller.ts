import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerFromInviteSchema,
  registerSchema,
} from './auth.schema';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { TenantMembershipGuard } from './tenant-membership.guard';

type RequestWithAuthAndTenant = Request & {
  authUser?: {
    sub: string;
    tenantId: string;
    role: string;
    jti: string;
    exp: number;
    iat: number;
  };
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    return this.authService.register(registerSchema.parse(body));
  }

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  async login(@Body() body: unknown) {
    return this.authService.login(loginSchema.parse(body));
  }

  @Post('register-from-invite')
  async registerFromInvite(@Body() body: unknown) {
    return this.authService.registerFromInvite(
      registerFromInviteSchema.parse(body),
    );
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    return this.authService.refresh(refreshSchema.parse(body));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async logout(@Body() body: unknown) {
    const parsed = logoutSchema.parse(body);
    return this.authService.logout(parsed.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  me(@Req() req: RequestWithAuthAndTenant) {
    return {
      user: {
        id: req.authUser?.sub,
      },
      tenant: req.tenant,
      role: req.authUser?.role,
    };
  }
}
