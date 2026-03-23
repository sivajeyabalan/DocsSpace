import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { RoleGuard } from './role.guard';
import { TenantMembershipGuard } from './tenant-membership.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    LoginRateLimitGuard,
    TenantMembershipGuard,
    RoleGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    TenantMembershipGuard,
    RoleGuard,
  ],
})
export class AuthModule {}
